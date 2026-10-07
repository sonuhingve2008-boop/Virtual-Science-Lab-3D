import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* =========================================================
   THREE.JS SETUP
========================================================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);

const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(10, 8, 12);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 2, 0);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();

const ambient = new THREE.HemisphereLight(
    0xffffff,
    0x334155,
    2.2
);

scene.add(ambient);

const mainLight = new THREE.DirectionalLight(
    0xffffff,
    3
);

mainLight.position.set(5, 10, 5);
mainLight.castShadow = true;
scene.add(mainLight);

const pointLight = new THREE.PointLight(
    0x60a5fa,
    20,
    30
);

pointLight.position.set(0, 7, 0);
scene.add(pointLight);


/* =========================================================
   GLOBAL STATE
========================================================= */

const draggableObjects = [];

let currentSubject = null;
let currentExperiment = null;
let experimentGroup = null;

let dragObject = null;
let dragOffset = new THREE.Vector3();

const dragPlane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    -3
);

let slideOnStage = false;

let chemistryBeaker = null;
let chemistrySamples = [];
let pouredSamples = [];
let phStrip = null;
let phValue = 7;

let circuitState = null;
let logicState = null;
let selectedLogicGate = "AND";
let pendulumState = null;

let solarBodies = [];
let solarOrbits = [];

window.photoState = null;


/* =========================================================
   UI
========================================================= */

const status = document.getElementById("status");
const infoTitle = document.getElementById("infoTitle");
const infoText = document.getElementById("infoText");
const experimentButtons =
    document.getElementById("experimentButtons");
const experimentControls =
    document.getElementById("experimentControls");
const experimentTitle =
    document.getElementById("experimentTitle");


function setStatus(text) {
    status.textContent = text;
}


function setInfo(title, text) {
    infoTitle.textContent = title;
    infoText.innerHTML = text;
}


/* =========================================================
   ROOM
========================================================= */

function createRoom() {

    const floor = new THREE.Mesh(
        new THREE.BoxGeometry(24, 0.4, 18),
        new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.7
        })
    );

    floor.position.y = -0.2;
    floor.receiveShadow = true;
    scene.add(floor);


    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(24, 10, 0.3),
        new THREE.MeshStandardMaterial({
            color: 0x172033
        })
    );

    backWall.position.set(0, 5, -6);
    scene.add(backWall);


    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 10, 18),
        new THREE.MeshStandardMaterial({
            color: 0x111827
        })
    );

    leftWall.position.set(-12, 5, 0);
    scene.add(leftWall);


    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 10, 18),
        new THREE.MeshStandardMaterial({
            color: 0x111827
        })
    );

    rightWall.position.set(12, 5, 0);
    scene.add(rightWall);

    createLabTable();
}


function createLabTable() {

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(16, 0.45, 6),
        new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.5
        })
    );

    top.position.set(0, 3, 1);
    top.castShadow = true;
    top.receiveShadow = true;
    scene.add(top);


    const positions = [
        [-6.5, 1.5, -1],
        [6.5, 1.5, -1],
        [-6.5, 1.5, 3],
        [6.5, 1.5, 3]
    ];

    positions.forEach(p => {

        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 3, 0.5),
            new THREE.MeshStandardMaterial({
                color: 0x475569
            })
        );

        leg.position.set(...p);
        leg.castShadow = true;
        scene.add(leg);
    });
}


createRoom();


/* =========================================================
   CLEAN EXPERIMENT
========================================================= */

function clearExperiment() {

    const certificate =
        document.getElementById("certificateOverlay");

    if (certificate) {
        certificate.remove();
    }

    window.photoState = null;

    if (experimentGroup) {

        scene.remove(experimentGroup);

        experimentGroup.traverse(obj => {

            if (obj.geometry) {
                obj.geometry.dispose();
            }

            if (obj.material) {

                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }

    experimentGroup = new THREE.Group();
    scene.add(experimentGroup);

    draggableObjects.length = 0;

    chemistrySamples = [];
    pouredSamples = [];
    chemistryBeaker = null;
    phStrip = null;

    slideOnStage = false;

    circuitState = null;
    logicState = null;
    pendulumState = null;

    solarBodies = [];
    solarOrbits = [];
}


/* =========================================================
   MATERIALS
========================================================= */

function mat(color, options = {}) {

    return new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.5,
        metalness: options.metalness ?? 0
    });
}


function addObject(object) {

    experimentGroup.add(object);

    return object;
}


/* =========================================================
   DRAG SYSTEM
========================================================= */

function makeDraggable(object, label = "") {

    object.userData.draggable = true;
    object.userData.dragLabel = label;

    draggableObjects.push(object);

    return object;
}


function getDragRoot(object) {

    let current = object;

    while (current) {

        if (
            current.userData &&
            current.userData.draggable
        ) {
            return current;
        }

        current = current.parent;
    }

    return null;
}


function updateMouse(event) {

    const rect =
        renderer.domElement.getBoundingClientRect();

    mouse.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

    mouse.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
}


function findDraggable(event) {

    updateMouse(event);

    raycaster.setFromCamera(mouse, camera);

    const meshes = [];

    draggableObjects.forEach(root => {

        root.traverse(child => {

            if (child.isMesh) {
                meshes.push(child);
            }
        });
    });

    const hits =
        raycaster.intersectObjects(meshes, true);

    if (!hits.length) {
        return null;
    }

    return getDragRoot(hits[0].object);
}


renderer.domElement.addEventListener(
    "pointerdown",
    event => {

        const object = findDraggable(event);

        if (!object) return;

        dragObject = object;

        const hit = new THREE.Vector3();

        raycaster.ray.intersectPlane(
            dragPlane,
            hit
        );

        if (hit) {

            dragOffset.subVectors(
                dragObject.position,
                hit
            );
        }

        controls.enabled = false;

        renderer.domElement.setPointerCapture(
            event.pointerId
        );

        setStatus(
            `Dragging ${dragObject.userData.dragLabel || "equipment"}...`
        );
    }
);


renderer.domElement.addEventListener(
    "pointermove",
    event => {

        if (!dragObject) return;

        updateMouse(event);

        raycaster.setFromCamera(
            mouse,
            camera
        );

        const hit = new THREE.Vector3();

        if (
            raycaster.ray.intersectPlane(
                dragPlane,
                hit
            )
        ) {

            dragObject.position.x =
                hit.x + dragOffset.x;

            dragObject.position.z =
                hit.z + dragOffset.z;
        }
    }
);


renderer.domElement.addEventListener(
    "pointerup",
    event => {

        if (!dragObject) return;

        const object = dragObject;

        dragObject = null;

        controls.enabled = true;

        try {
            renderer.domElement.releasePointerCapture(
                event.pointerId
            );
        } catch {}

        handleDrop(object);
    }
);


function handleDrop(object) {

    if (currentSubject === "biology") {
        handleBiologyDrop(object);
    }

    if (currentSubject === "chemistry") {
        handleChemistryDrop(object);
    }

    if (currentSubject === "physics") {
        handlePhysicsDrop(object);
    }
}


/* =========================================================
   BASIC LAB EQUIPMENT
========================================================= */

function createBeaker() {

    const group = new THREE.Group();

    const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.9,
            0.75,
            1.7,
            32,
            1,
            true
        ),
        new THREE.MeshPhysicalMaterial({
            color: 0x9ddcff,
            transparent: true,
            opacity: 0.35,
            roughness: 0.1,
            transmission: 0.2
        })
    );

    group.add(glass);


    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(
            0.9,
            0.07,
            12,
            32
        ),
        mat(0xbfe9ff, {
            roughness: 0.1
        })
    );

    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.85;

    group.add(rim);


    const liquid = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.72,
            0.68,
            0.45,
            32
        ),
        mat(0x60a5fa, {
            roughness: 0.2
        })
    );

    liquid.position.y = -0.35;
    liquid.userData.isLiquid = true;

    group.add(liquid);

    group.userData.liquid = liquid;

    return group;
}


function createBottle(color, label) {

    const group = new THREE.Group();

    const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.42,
            0.48,
            1.2,
            24
        ),
        mat(color)
    );

    group.add(bottle);


    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.18,
            0.25,
            0.4,
            20
        ),
        mat(color)
    );

    neck.position.y = 0.8;

    group.add(neck);


    const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.21,
            0.21,
            0.15,
            20
        ),
        mat(0x1e293b)
    );

    cap.position.y = 1.05;

    group.add(cap);

    group.userData.label = label;

    return group;
}


function createSlide() {

    const group = new THREE.Group();

    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.7,
            0.08,
            0.9
        ),
        new THREE.MeshPhysicalMaterial({
            color: 0xbfe9ff,
            transparent: true,
            opacity: 0.65
        })
    );

    group.add(glass);


    const sample = new THREE.Mesh(
        new THREE.CircleGeometry(
            0.28,
            32
        ),
        mat(0x86efac)
    );

    sample.rotation.x = -Math.PI / 2;
    sample.position.y = 0.06;

    group.add(sample);

    return group;
}


/* =========================================================
   MICROSCOPE
========================================================= */

function createMicroscope() {

    const group = new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.BoxGeometry(
            2.2,
            0.35,
            1.5
        ),
        mat(0x334155, {
            metalness: 0.4
        })
    );

    base.position.y = 0.2;
    group.add(base);


    const vertical = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.35,
            2.5,
            0.35
        ),
        mat(0x475569, {
            metalness: 0.5
        })
    );

    vertical.position.set(
        -0.65,
        1.4,
        0
    );

    group.add(vertical);


    const arm = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.4,
            0.3,
            0.35
        ),
        mat(0x475569, {
            metalness: 0.5
        })
    );

    arm.position.set(
        -0.05,
        2.45,
        0
    );

    group.add(arm);


    const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.25,
            0.25,
            1.1,
            24
        ),
        mat(0x64748b, {
            metalness: 0.5
        })
    );

    tube.rotation.z = -0.4;

    tube.position.set(
        0.35,
        2.95,
        0
    );

    group.add(tube);


    const eyepiece = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.2,
            0.16,
            0.5,
            20
        ),
        mat(0x111827, {
            metalness: 0.7
        })
    );

    eyepiece.rotation.z = -0.4;

    eyepiece.position.set(
        0.7,
        3.4,
        0
    );

    group.add(eyepiece);


    const stage = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.8,
            0.15,
            1.4
        ),
        mat(0x64748b, {
            metalness: 0.5
        })
    );

    stage.position.set(
        0,
        1.05,
        0
    );

    group.add(stage);


    const stageTarget = new THREE.Mesh(
        new THREE.RingGeometry(
            0.45,
            0.58,
            32
        ),
        new THREE.MeshBasicMaterial({
            color: 0x22c55e,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide
        })
    );

    stageTarget.rotation.x = -Math.PI / 2;

    stageTarget.position.set(
        0,
        1.14,
        0
    );

    group.add(stageTarget);

    group.userData.stageTarget =
        stageTarget;

    return group;
}


/* =========================================================
   BIOLOGY
========================================================= */

function loadBiology(type) {

    clearExperiment();

    currentSubject = "biology";

    if (type === "plant") {
        createPlantCellExperiment();
    }
    else if (type === "animal") {
        createAnimalCellExperiment();
    }
    else {
        createPhotosynthesisExperiment();
    }
}


function createPlantCellExperiment() {

    const microscope = createMicroscope();

    microscope.position.set(
        -2.5,
        3,
        1
    );

    addObject(microscope);


    const slide = createSlide();

    slide.position.set(
        4,
        3.65,
        1
    );

    slide.userData.type = "slide";

    makeDraggable(
        slide,
        "Microscope Slide"
    );

    addObject(slide);


    const cellView = createPlantCell();

    cellView.position.set(
        1.5,
        6,
        1
    );

    cellView.visible = false;

    addObject(cellView);


    setInfo(
        "Plant Cell Observation",
        "Drag the microscope slide onto the green ring on the microscope stage. Then observe the cell and use zoom."
    );

    setStatus(
        "Step 1: Drag the slide under the microscope."
    );

    addBiologyControls(
        "Plant Cell",
        cellView
    );
}


function createAnimalCellExperiment() {

    const microscope = createMicroscope();

    microscope.position.set(
        -2.5,
        3,
        1
    );

    addObject(microscope);


    const slide = createSlide();

    slide.position.set(
        4,
        3.65,
        1
    );

    slide.userData.type = "slide";

    makeDraggable(
        slide,
        "Animal Cell Slide"
    );

    addObject(slide);


    const cellView = createAnimalCell();

    cellView.position.set(
        1.5,
        6,
        1
    );

    cellView.visible = false;

    addObject(cellView);


    setInfo(
        "Animal Cell Observation",
        "Drag the prepared slide onto the microscope stage. After placing it correctly, observe the cell."
    );

    setStatus(
        "Step 1: Drag the animal-cell slide under the microscope."
    );

    addBiologyControls(
        "Animal Cell",
        cellView
    );
}


/* =========================================================
   INTERACTIVE PHOTOSYNTHESIS
========================================================= */

function createPhotosynthesisExperiment() {

    const state = {
        water: false,
        co2: false,
        light: false,
        leaf: false,
        started: false,
        bubbles: []
    };

    window.photoState = state;


    const beaker = createBeaker();

    beaker.position.set(
        -3.2,
        3.9,
        1
    );

    beaker.userData.photoType = "water";

    makeDraggable(
        beaker,
        "Water Container"
    );

    addObject(beaker);


    const co2 = createBottle(
        0x94a3b8,
        "CO₂ Source"
    );

    co2.position.set(
        0,
        3.7,
        1
    );

    co2.userData.photoType = "co2";

    makeDraggable(
        co2,
        "CO₂ Source"
    );

    addObject(co2);


    const leafGroup = new THREE.Group();

    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.07,
            0.07,
            1.3,
            16
        ),
        mat(0x166534)
    );

    stem.rotation.z = Math.PI / 2;

    leafGroup.add(stem);


    const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.9,
            32,
            20
        ),
        mat(0x16a34a, {
            roughness: 0.65
        })
    );

    leaf.scale.set(
        1.55,
        0.22,
        0.72
    );

    leaf.position.x = 0.65;

    leafGroup.add(leaf);


    leafGroup.position.set(
        3.5,
        4,
        1
    );

    leafGroup.userData.photoType =
        "leaf";

    makeDraggable(
        leafGroup,
        "Green Leaf"
    );

    addObject(leafGroup);


    const sun = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.65,
            24,
            18
        ),
        new THREE.MeshBasicMaterial({
            color: 0xfacc15
        })
    );

    sun.position.set(
        3.8,
        7,
        1
    );

    addObject(sun);


    const rays = new THREE.Group();

    for (let i = 0; i < 8; i++) {

        const angle =
            (i / 8) * Math.PI * 2;

        const ray = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.025,
                0.025,
                0.7,
                8
            ),
            new THREE.MeshBasicMaterial({
                color: 0xfacc15
            })
        );

        ray.position.set(
            3.8 + Math.cos(angle) * 0.95,
            7 + Math.sin(angle) * 0.95,
            1
        );

        ray.rotation.z = -angle;

        rays.add(ray);
    }

    rays.visible = false;

    addObject(rays);

    state.rays = rays;


    experimentControls.innerHTML = `

        <div class="controlTitle">
            ☀ Photosynthesis Lab
        </div>

        <div class="controlInfo">
            1. Drag water to the plant area.<br>
            2. Drag CO₂ source to the plant area.<br>
            3. Turn sunlight ON.<br>
            4. Place the leaf.<br>
            5. Start photosynthesis.
        </div>

        <button id="photoLight">
            ☀ Turn Sunlight ON
        </button>

        <button id="photoStart">
            ▶ Start Photosynthesis
        </button>

        <button id="photoReset">
            🔄 Reset
        </button>

        <div id="photoResult" class="controlInfo">
            Missing: water, CO₂, sunlight and leaf
        </div>
    `;


    const result =
        document.getElementById(
            "photoResult"
        );


    document.getElementById(
        "photoLight"
    ).onclick = () => {

        state.light = !state.light;

        rays.visible = state.light;

        document.getElementById(
            "photoLight"
        ).textContent =
            state.light
                ? "☀ Sunlight ON"
                : "☀ Turn Sunlight ON";

        updatePhotoResult();
    };


    document.getElementById(
        "photoStart"
    ).onclick = () => {

        if (
            !state.water ||
            !state.co2 ||
            !state.light ||
            !state.leaf
        ) {

            setStatus(
                "❌ Add water, CO₂, sunlight and the leaf first."
            );

            return;
        }

        state.started = true;

        createOxygenBubbles();

        updatePhotoResult();

        setStatus(
            "🌱 Photosynthesis is occurring — oxygen is being released!"
        );
    };


    document.getElementById(
        "photoReset"
    ).onclick = () => {

        loadBiology(
            "photosynthesis"
        );
    };


    function updatePhotoResult() {

        if (state.started) {

            result.innerHTML =
                "<b>Reaction complete:</b><br>" +
                "CO₂ + H₂O + light → glucose + O₂";

            return;
        }

        const missing = [];

        if (!state.water) {
            missing.push("water");
        }

        if (!state.co2) {
            missing.push("CO₂");
        }

        if (!state.light) {
            missing.push("sunlight");
        }

        if (!state.leaf) {
            missing.push("leaf");
        }

        if (!missing.length) {

            result.innerHTML =
                "<b>Ready!</b> All conditions are present. " +
                "Click Start Photosynthesis.";

        }
        else {

            result.textContent =
                "Missing: " +
                missing.join(", ");
        }
    }


    function createOxygenBubbles() {

        state.bubbles.forEach(
            bubble =>
                experimentGroup.remove(
                    bubble
                )
        );

        state.bubbles = [];

        for (let i = 0; i < 10; i++) {

            const bubble =
                new THREE.Mesh(
                    new THREE.SphereGeometry(
                        0.08 + Math.random() * 0.05,
                        12,
                        10
                    ),
                    new THREE.MeshPhysicalMaterial({
                        color: 0xe0f2fe,
                        transparent: true,
                        opacity: 0.8
                    })
                );

            bubble.position.set(
                2.8 + Math.random() * 1.5,
                3.6 + Math.random() * 0.5,
                0.8 + Math.random() * 0.4
            );

            addObject(bubble);

            state.bubbles.push(
                bubble
            );
        }
    }


    setInfo(
        "Photosynthesis",
        "The plant needs water, carbon dioxide and sunlight. Perform the steps and observe oxygen production."
    );

    setStatus(
        "Drag water, CO₂ and the leaf into the experiment area."
    );
}


function createPlantCell() {

    const group = new THREE.Group();


    const membrane = new THREE.Mesh(
        new THREE.SphereGeometry(
            1.5,
            32,
            24
        ),
        new THREE.MeshStandardMaterial({
            color: 0x86efac,
            transparent: true,
            opacity: 0.25,
            wireframe: true
        })
    );

    group.add(membrane);


    const nucleus = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.45,
            24,
            16
        ),
        mat(0x7c3aed)
    );

    group.add(nucleus);


    for (let i = 0; i < 8; i++) {

        const chloroplast =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.16,
                    16,
                    12
                ),
                mat(0x16a34a)
            );

        const angle =
            (i / 8) * Math.PI * 2;

        chloroplast.position.set(
            Math.cos(angle) * 0.9,
            Math.sin(angle) * 0.7,
            0
        );

        group.add(chloroplast);
    }

    return group;
}


function createAnimalCell() {

    const group = new THREE.Group();


    const membrane = new THREE.Mesh(
        new THREE.SphereGeometry(
            1.5,
            32,
            24
        ),
        new THREE.MeshStandardMaterial({
            color: 0xf9a8d4,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        })
    );

    group.add(membrane);


    const nucleus = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.5,
            24,
            16
        ),
        mat(0x7c3aed)
    );

    group.add(nucleus);


    for (let i = 0; i < 7; i++) {

        const organelle =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.13,
                    16,
                    12
                ),
                mat(0xf97316)
            );

        const angle =
            (i / 7) * Math.PI * 2;

        organelle.position.set(
            Math.cos(angle) * 0.85,
            Math.sin(angle) * 0.6,
            0
        );

        group.add(organelle);
    }

    return group;
}


function addBiologyControls(
    name,
    cellView
) {

    experimentControls.innerHTML = `

        <div class="controlTitle">
            🔬 ${name} Microscope
        </div>

        <div class="controlInfo">
            1. Drag the slide onto the green stage.<br>
            2. Observe the specimen.<br>
            3. Use zoom controls.
        </div>

        <button id="observeBtn">
            🔍 Observe Slide
        </button>

        <button id="zoomIn">
            🔎 Zoom In
        </button>

        <button id="zoomOut">
            🔍 Zoom Out
        </button>
    `;


    document.getElementById(
        "observeBtn"
    ).onclick = () => {

        if (!slideOnStage) {

            setStatus(
                "❌ First drag the slide onto the microscope stage."
            );

            return;
        }

        cellView.visible = true;

        setStatus(
            "✅ Slide observed! You can now zoom."
        );
    };


    document.getElementById(
        "zoomIn"
    ).onclick = () => {

        if (!cellView.visible) {

            setStatus(
                "Place and observe the slide first."
            );

            return;
        }

        cellView.scale.multiplyScalar(
            1.2
        );

        setStatus(
            "🔎 Microscope zoom increased."
        );
    };


    document.getElementById(
        "zoomOut"
    ).onclick = () => {

        if (!cellView.visible) return;

        cellView.scale.multiplyScalar(
            0.83
        );

        setStatus(
            "🔍 Microscope zoom decreased."
        );
    };
}


function handleBiologyDrop(object) {

    if (
        object.userData.type === "slide"
    ) {

        const microscope =
            experimentGroup.children.find(
                obj =>
                    obj.userData &&
                    obj.userData.stageTarget
            );

        if (!microscope) return;

        const target =
            new THREE.Vector3();

        microscope.userData.stageTarget
            .getWorldPosition(target);

        const distance =
            object.position.distanceTo(target);

        if (distance < 1.3) {

            object.position.copy(
                experimentGroup.worldToLocal(
                    target.clone()
                )
            );

            object.position.y += 0.12;

            slideOnStage = true;

            setStatus(
                "✅ Slide correctly placed under microscope."
            );

        } else {

            slideOnStage = false;

            setStatus(
                "❌ Put the slide on the green microscope ring."
            );
        }

        return;
    }


    if (
        currentExperiment ===
        "photosynthesis" &&
        window.photoState
    ) {

        const state =
            window.photoState;

        const plantArea =
            new THREE.Vector3(
                2.8,
                4,
                1
            );


        if (
            object.userData.photoType ===
            "water"
        ) {

            if (
                object.position.distanceTo(
                    plantArea
                ) < 3.5
            ) {

                state.water = true;

                setStatus(
                    "💧 Water supplied to the plant."
                );

            } else {

                setStatus(
                    "Move the water container near the plant."
                );
            }
        }


        else if (
            object.userData.photoType ===
            "co2"
        ) {

            if (
                object.position.distanceTo(
                    plantArea
                ) < 3.5
            ) {

                state.co2 = true;

                setStatus(
                    "🫧 CO₂ supplied to the plant."
                );

            } else {

                setStatus(
                    "Move the CO₂ source near the plant."
                );
            }
        }


        else if (
            object.userData.photoType ===
            "leaf"
        ) {

            if (
                object.position.distanceTo(
                    plantArea
                ) < 3.5
            ) {

                state.leaf = true;

                setStatus(
                    "🌱 Leaf placed in the experiment area."
                );

            } else {

                setStatus(
                    "Move the leaf into the experiment area."
                );
            }
        }
    }
}


/* =========================================================
   CHEMISTRY
========================================================= */

function loadChemistry(type) {

    clearExperiment();

    currentSubject = "chemistry";

    if (type === "ph") {
        createPHExperiment();
    }
    else if (type === "filtration") {
        createFiltrationExperiment();
    }
    else {
        createReactionExperiment();
    }
}


/* =========================================================
   pH EXPERIMENT
========================================================= */

function createPHExperiment() {

    chemistryBeaker = createBeaker();

    chemistryBeaker.position.set(
        0,
        3.9,
        1
    );

    addObject(chemistryBeaker);

    makeDraggable(
        chemistryBeaker,
        "Beaker"
    );


    const neutralBottle =
        createBottle(
            0x60a5fa,
            "Neutral Sample"
        );

    neutralBottle.position.set(
        -4,
        3.7,
        1
    );

    neutralBottle.userData.sampleType =
        "neutral";

    makeDraggable(
        neutralBottle,
        "Neutral Sample"
    );

    addObject(neutralBottle);


    const acidBottle =
        createBottle(
            0xef4444,
            "Acidic Sample"
        );

    acidBottle.position.set(
        -1.8,
        3.7,
        1
    );

    acidBottle.userData.sampleType =
        "acid";

    makeDraggable(
        acidBottle,
        "Acidic Sample"
    );

    addObject(acidBottle);


    const baseBottle =
        createBottle(
            0x3b82f6,
            "Basic Sample"
        );

    baseBottle.position.set(
        4,
        3.7,
        1
    );

    baseBottle.userData.sampleType =
        "base";

    makeDraggable(
        baseBottle,
        "Basic Sample"
    );

    addObject(baseBottle);


    chemistrySamples = [
        neutralBottle,
        acidBottle,
        baseBottle
    ];


    phStrip = createPHStrip();

    phStrip.position.set(
        6,
        3.5,
        1
    );

    makeDraggable(
        phStrip,
        "pH Paper"
    );

    addObject(phStrip);


    const meter =
        createPHMeter();

    meter.position.set(
        6,
        4.5,
        1
    );

    addObject(meter);

    chemistryBeaker.userData.meter =
        meter;


    setInfo(
        "Hands-on pH Experiment",
        "Drag a sample bottle over the beaker to pour it. Then drag pH paper into the solution and check the pH meter."
    );

    setStatus(
        "Step 1: Drag a sample bottle over the beaker."
    );


    experimentControls.innerHTML = `

        <div class="controlTitle">
            🧪 pH Practical
        </div>

        <div class="controlInfo">
            • Drag sample bottle over beaker.<br>
            • Release to pour the sample.<br>
            • Drag pH paper into solution.<br>
            • Read the pH value.
        </div>

        <button id="resetPH">
            🔄 Reset pH Experiment
        </button>
    `;


    document.getElementById(
        "resetPH"
    ).onclick = () => {

        loadChemistry("ph");
    };
}


function createPHStrip() {

    const group = new THREE.Group();

    const paper = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.35,
            0.08,
            1.3
        ),
        mat(0xf8fafc)
    );

    group.add(paper);


    const indicator = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.25,
            0.09,
            0.25
        ),
        mat(0xfacc15)
    );

    indicator.position.y = 0.07;

    group.add(indicator);

    group.userData.indicator =
        indicator;

    group.userData.dipped = false;

    return group;
}


function createPHMeter() {

    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.6,
            1,
            0.5
        ),
        mat(0x1e293b)
    );

    group.add(body);


    const screen = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.1,
            0.5,
            0.05
        ),
        mat(0x0f172a)
    );

    screen.position.z = 0.28;

    group.add(screen);

    group.userData.screen =
        screen;

    return group;
}


function handleChemistryDrop(object) {

    if (!chemistryBeaker) return;


    if (
        object.userData.sampleType
    ) {

        const distance =
            object.position.distanceTo(
                chemistryBeaker.position
            );

        if (distance < 1.8) {

            if (
                currentExperiment ===
                "reaction"
            ) {

                pourReactionSample(
                    object
                );

            } else {

                pourSample(
                    object,
                    object.userData.sampleType
                );
            }

        } else {

            setStatus(
                "Bring the sample directly over the beaker."
            );
        }

        return;
    }


    if (
        object === phStrip
    ) {

        const distance =
            object.position.distanceTo(
                chemistryBeaker.position
            );

        if (distance < 1.5) {

            dipPHStrip();

        } else {

            setStatus(
                "Dip the pH paper into the beaker."
            );
        }
    }
}


function pourSample(
    bottle,
    sampleType
) {

    if (
        pouredSamples.includes(
            sampleType
        )
    ) {

        setStatus(
            "This sample has already been added."
        );

        return;
    }


    pouredSamples.push(
        sampleType
    );


    const original =
        bottle.position.clone();

    const target =
        chemistryBeaker.position.clone();


    bottle.position.x =
        target.x;

    bottle.position.z =
        target.z;

    bottle.position.y =
        target.y + 1.4;

    bottle.rotation.z =
        -0.65;


    createPourStream(
        bottle,
        chemistryBeaker,
        sampleType
    );


    setTimeout(() => {

        bottle.rotation.z = 0;

        bottle.position.copy(
            original
        );

    }, 900);


    updatePHState();


    setStatus(
        "🧪 Virtual sample added to the beaker."
    );
}


function createPourStream(
    bottle,
    beaker,
    type = "neutral"
) {

    const colors = {
        acid: 0xef4444,
        base: 0x3b82f6,
        neutral: 0x60a5fa
    };

    const stream =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.06,
                0.06,
                1.2,
                12
            ),
            mat(
                colors[type] ||
                0x93c5fd
            )
        );


    stream.position.set(
        beaker.position.x,
        beaker.position.y + 0.8,
        beaker.position.z
    );

    addObject(stream);


    setTimeout(() => {

        experimentGroup.remove(
            stream
        );

    }, 800);
}


function updatePHState() {

    const acid =
        pouredSamples.includes("acid");

    const base =
        pouredSamples.includes("base");

    const neutral =
        pouredSamples.includes("neutral");


    if (acid && base) {
        phValue = 7;
    }
    else if (acid) {
        phValue = 3;
    }
    else if (base) {
        phValue = 10;
    }
    else {
        phValue = 7;
    }


    if (
        chemistryBeaker &&
        chemistryBeaker.userData.liquid
    ) {

        const liquid =
            chemistryBeaker.userData.liquid;


        if (acid && base) {

            liquid.material.color.set(
                0x8b5cf6
            );

        }
        else if (acid) {

            liquid.material.color.set(
                0xf87171
            );

        }
        else if (base) {

            liquid.material.color.set(
                0x60a5fa
            );

        }
        else {

            liquid.material.color.set(
                0x93c5fd
            );
        }
    }

    updatePHMeter();
}


function dipPHStrip() {

    if (!pouredSamples.length) {

        setStatus(
            "❌ Add a sample first."
        );

        return;
    }


    phStrip.userData.dipped =
        true;


    const indicator =
        phStrip.userData.indicator;


    if (phValue <= 4) {

        indicator.material.color.set(
            0xef4444
        );

    }
    else if (phValue >= 9) {

        indicator.material.color.set(
            0x2563eb
        );

    }
    else {

        indicator.material.color.set(
            0x22c55e
        );
    }


    phStrip.position.copy(
        chemistryBeaker.position
    );

    phStrip.position.y += 0.5;


    setStatus(
        `✅ pH paper checked the solution. pH = ${phValue}`
    );
}


function updatePHMeter() {

    if (
        !chemistryBeaker ||
        !chemistryBeaker.userData.meter
    ) return;


    chemistryBeaker.userData.meter
        .userData.value = phValue;
}


/* =========================================================
   FILTRATION
========================================================= */

function createFiltrationExperiment() {

    const stand =
        new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.BoxGeometry(
            5,
            0.25,
            2
        ),
        mat(0x475569)
    );

    stand.add(base);


    const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.08,
            0.08,
            4,
            16
        ),
        mat(0x94a3b8, {
            metalness: 0.7
        })
    );

    rod.position.set(
        -1.8,
        2,
        0
    );

    stand.add(rod);


    const funnel =
        new THREE.Mesh(
            new THREE.ConeGeometry(
                1,
                1.4,
                32,
                1,
                true
            ),
            new THREE.MeshPhysicalMaterial({
                color: 0xbfe9ff,
                transparent: true,
                opacity: 0.45
            })
        );

    funnel.position.set(
        0,
        4.2,
        1
    );

    addObject(funnel);


    const paper =
        new THREE.Mesh(
            new THREE.ConeGeometry(
                0.75,
                0.02,
                32
            ),
            mat(0xf8fafc)
        );

    paper.position.set(
        0,
        4.08,
        1
    );

    addObject(paper);


    const beaker =
        createBeaker();

    beaker.position.set(
        0,
        3.3,
        1
    );

    addObject(beaker);

    makeDraggable(
        beaker,
        "Collection Beaker"
    );


    const mixture =
        createBottle(
            0x92400e,
            "Mixture"
        );

    mixture.position.set(
        4,
        3.7,
        1
    );

    mixture.userData.filtrationMixture =
        true;

    makeDraggable(
        mixture,
        "Mixture Bottle"
    );

    addObject(mixture);


    experimentControls.innerHTML = `

        <div class="controlTitle">
            🧻 Filtration
        </div>

        <div class="controlInfo">
            Move the mixture above the funnel.
            The solid particles are separated from
            the liquid.
        </div>

        <button id="filterReset">
            🔄 Reset Filtration
        </button>
    `;


    setInfo(
        "Filtration Experiment",
        "Place the collection beaker below the funnel and drag the mixture bottle above the funnel to begin filtration."
    );

    setStatus(
        "Drag the mixture bottle toward the funnel."
    );


    mixture.userData.onFiltered =
        false;


    document.getElementById(
        "filterReset"
    ).onclick = () =>
        loadChemistry("filtration");
}


function performFiltration(
    mixture
) {

    if (
        mixture.userData.onFiltered
    ) return;

    mixture.userData.onFiltered =
        true;

    const stream =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.07,
                0.07,
                1.5,
                12
            ),
            mat(0x92400e)
        );

    stream.position.set(
        0,
        4,
        1
    );

    addObject(stream);


    setTimeout(() => {

        experimentGroup.remove(
            stream
        );

        setStatus(
            "✅ Filtration complete. Solid particles remain in the filter while the liquid passes into the beaker."
        );

    }, 1500);
}


/* =========================================================
   CHEMICAL REACTION
========================================================= */

function createReactionExperiment() {

    chemistryBeaker =
        createBeaker();

    chemistryBeaker.position.set(
        0,
        3.8,
        1
    );

    addObject(chemistryBeaker);

    makeDraggable(
        chemistryBeaker,
        "Reaction Beaker"
    );


    const chemicals = [
        {
            color: 0xef4444,
            x: -5,
            type: "reactionA",
            name: "Hydrochloric Acid"
        },
        {
            color: 0x3b82f6,
            x: -2.5,
            type: "reactionB",
            name: "Sodium Hydroxide"
        },
        {
            color: 0x22c55e,
            x: 2.5,
            type: "reactionC",
            name: "Indicator"
        },
        {
            color: 0xf59e0b,
            x: 5,
            type: "reactionD",
            name: "Salt Solution"
        }
    ];


    chemicals.forEach(data => {

        const bottle =
            createBottle(
                data.color,
                data.name
            );

        bottle.position.set(
            data.x,
            3.7,
            1
        );

        bottle.userData.sampleType =
            data.type;

        bottle.userData.reactionName =
            data.name;

        makeDraggable(
            bottle,
            data.name
        );

        addObject(bottle);
    });


    chemistryBeaker.userData.reactionCount =
        0;


    setInfo(
        "Chemical Reaction",
        "Four virtual chemicals are available. Add them to the beaker one by one and observe the color change and reaction effects."
    );

    setStatus(
        "Drag the chemicals into the reaction beaker."
    );


    experimentControls.innerHTML = `

        <div class="controlTitle">
            ⚗ Chemical Reaction
        </div>

        <div class="controlInfo">
            Add different chemicals one by one.
            The solution changes as the reaction proceeds.
        </div>

        <button id="reactionReset">
            🔄 Reset Reaction
        </button>

        <div id="reactionResult"
             class="controlInfo">
            Chemicals added: 0
        </div>
    `;


    document.getElementById(
        "reactionReset"
    ).onclick = () =>
        loadChemistry("reaction");
}


function pourReactionSample(
    bottle
) {

    const beaker =
        chemistryBeaker;

    if (!beaker) return;


    if (
        bottle.userData.used
    ) {

        setStatus(
            "This chemical has already been added."
        );

        return;
    }


    bottle.userData.used = true;

    beaker.userData.reactionCount++;


    const count =
        beaker.userData.reactionCount;


    const colors = [
        0xf87171,
        0xa78bfa,
        0x22c55e,
        0xfacc15
    ];


    beaker.userData.liquid
        .material.color.set(
            colors[
                Math.min(
                    count - 1,
                    colors.length - 1
                )
            ]
        );


    createPourStream(
        bottle,
        beaker,
        bottle.userData.sampleType ===
        "reactionA"
            ? "acid"
            : "base"
    );


    const result =
        document.getElementById(
            "reactionResult"
        );

    if (result) {

        result.innerHTML =
            `<b>Chemicals added:</b> ${count}/4<br>` +
            `${bottle.userData.reactionName} added.`;
    }


    if (count >= 4) {

        createReactionBubbles();

        setStatus(
            "🧪 Reaction complete! The mixed solution is showing the final reaction effect."
        );

        if (result) {

            result.innerHTML =
                "<b>Reaction complete!</b><br>" +
                "The four virtual chemicals have been mixed.";
        }

    } else {

        setStatus(
            `${bottle.userData.reactionName} added to the beaker.`
        );
    }
}


function createReactionBubbles() {

    for (let i = 0; i < 14; i++) {

        const bubble =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.06 + Math.random() * 0.05,
                    12,
                    10
                ),
                new THREE.MeshPhysicalMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.75
                })
            );

        bubble.position.set(
            -0.5 + Math.random(),
            4 + Math.random() * 0.6,
            0.5 + Math.random()
        );

        bubble.userData.reactionBubble =
            true;

        addObject(bubble);
    }
}


/* =========================================================
   PHYSICS
========================================================= */

function loadPhysics(type) {

    clearExperiment();

    currentSubject = "physics";

    if (type === "circuit") {
        createCircuitExperiment();
    }
    else if (type === "pendulum") {
        createPendulumExperiment();
    }
    else {
        createLogicExperiment();
    }
}


/* =========================================================
   TERMINALS + WIRES
========================================================= */

function makeTerminal(
    position,
    id,
    label,
    color = 0xef4444
) {

    const terminal =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.13,
                16,
                12
            ),
            new THREE.MeshStandardMaterial({
                color,
                metalness: 0.65,
                roughness: 0.25,
                emissive: 0x000000
            })
        );

    terminal.position.copy(position);

    terminal.userData.terminal =
        true;

    terminal.userData.terminalId =
        id;

    terminal.userData.terminalLabel =
        label;

    return terminal;
}


function makeWire(
    a,
    b,
    color = 0xef4444
) {

    const start =
        a.getWorldPosition(
            new THREE.Vector3()
        );

    const end =
        b.getWorldPosition(
            new THREE.Vector3()
        );

    const direction =
        new THREE.Vector3()
            .subVectors(
                end,
                start
            );

    const length =
        direction.length();


    const wire =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.055,
                0.055,
                length,
                12
            ),
            new THREE.MeshStandardMaterial({
                color,
                roughness: 0.35,
                metalness: 0.15
            })
        );


    wire.position.copy(
        start
    ).add(
        end
    ).multiplyScalar(
        0.5
    );


    wire.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize()
    );

    wire.userData.wire = true;

    return wire;
}


function connectionKey(a, b) {

    return [
        a,
        b
    ].sort().join("|");
}


function connectPhysicsTerminals(
    state,
    a,
    b
) {

    if (!a || !b || a === b) {
        return;
    }


    const idA =
        a.userData.terminalId;

    const idB =
        b.userData.terminalId;


    const key =
        connectionKey(
            idA,
            idB
        );


    if (
        state.connections.includes(
            key
        )
    ) {
        return;
    }


    const wire =
        makeWire(
            a,
            b,
            state === circuitState
                ? 0xef4444
                : 0x22d3ee
        );


    addObject(wire);

    state.wires.push(wire);
    state.connections.push(key);


    a.material.emissive.set(
        0x3b82f6
    );

    b.material.emissive.set(
        0x3b82f6
    );
}


/* =========================================================
   ELECTRIC CIRCUIT
========================================================= */

function createCircuitExperiment() {

    circuitState = {
        terminals: {},
        connections: [],
        wires: [],
        selectedTerminal: null,
        switchOn: false,
        bulbMaterial: null,
        switchGroup: null
    };


    const battery =
        createBattery();

    battery.position.set(
        -4.5,
        3.8,
        1
    );

    battery.userData.physicsPart =
        "battery";

    addObject(battery);

    makeDraggable(
        battery,
        "Battery"
    );


    const batteryPlus =
        makeTerminal(
            new THREE.Vector3(
                0,
                0.92,
                0
            ),
            "battery+",
            "Battery +",
            0xef4444
        );


    const batteryMinus =
        makeTerminal(
            new THREE.Vector3(
                0,
                -0.92,
                0
            ),
            "battery-",
            "Battery -",
            0x2563eb
        );


    battery.add(
        batteryPlus,
        batteryMinus
    );


    circuitState.terminals[
        "battery+"
    ] = batteryPlus;

    circuitState.terminals[
        "battery-"
    ] = batteryMinus;


    /* RESISTOR */

    const resistor =
        new THREE.Group();


    const resistorBody =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.25,
                0.45,
                0.55
            ),
            new THREE.MeshStandardMaterial({
                color: 0xd97706,
                roughness: 0.4
            })
        );


    resistor.add(
        resistorBody
    );


    for (
        let i = -2;
        i <= 2;
        i++
    ) {

        const band =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.12,
                    0.47,
                    0.57
                ),
                new THREE.MeshStandardMaterial({
                    color:
                        i === 0
                            ? 0x111827
                            : 0xfef3c7
                })
            );

        band.position.x =
            i * 0.22;

        resistor.add(
            band
        );
    }


    const rA =
        makeTerminal(
            new THREE.Vector3(
                -0.85,
                0,
                0
            ),
            "resistorA",
            "Resistor A"
        );


    const rB =
        makeTerminal(
            new THREE.Vector3(
                0.85,
                0,
                0
            ),
            "resistorB",
            "Resistor B"
        );


    resistor.add(
        rA,
        rB
    );


    resistor.position.set(
        -1.5,
        3.65,
        1
    );

    resistor.userData.physicsPart =
        "resistor";

    addObject(resistor);

    makeDraggable(
        resistor,
        "Resistor"
    );


    circuitState.terminals.resistorA =
        rA;

    circuitState.terminals.resistorB =
        rB;


    /* BULB */

    const bulb =
        new THREE.Group();


    const bulbMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xb6c2cf,
            roughness: 0.2,
            metalness: 0.15,
            emissive: 0x000000,
            emissiveIntensity: 0
        });


    const glass =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.55,
                32,
                24
            ),
            bulbMaterial
        );


    const base =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.35,
                0.42,
                0.38,
                24
            ),
            new THREE.MeshStandardMaterial({
                color: 0x9ca3af,
                metalness: 0.75,
                roughness: 0.25
            })
        );


    base.position.y =
        -0.55;


    bulb.add(
        glass,
        base
    );


    const bA =
        makeTerminal(
            new THREE.Vector3(
                -0.48,
                -0.55,
                0
            ),
            "bulbA",
            "Bulb A"
        );


    const bB =
        makeTerminal(
            new THREE.Vector3(
                0.48,
                -0.55,
                0
            ),
            "bulbB",
            "Bulb B",
            0x2563eb
        );


    bulb.add(
        bA,
        bB
    );


    bulb.position.set(
        2,
        4,
        1
    );

    bulb.userData.physicsPart =
        "bulb";

    addObject(bulb);

    makeDraggable(
        bulb,
        "Bulb"
    );


    circuitState.terminals.bulbA =
        bA;

    circuitState.terminals.bulbB =
        bB;

    circuitState.bulbMaterial =
        bulbMaterial;


    /* SWITCH */

    const sw =
        new THREE.Group();


    const switchBase =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.3,
                0.18,
                0.75
            ),
            new THREE.MeshStandardMaterial({
                color: 0x334155,
                metalness: 0.5
            })
        );


    const lever =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.9,
                0.12,
                0.18
            ),
            new THREE.MeshStandardMaterial({
                color: 0xef4444
            })
        );


    lever.position.y =
        0.18;

    lever.rotation.z =
        0.25;


    sw.add(
        switchBase,
        lever
    );


    const sA =
        makeTerminal(
            new THREE.Vector3(
                -0.75,
                0,
                0
            ),
            "switchA",
            "Switch A"
        );


    const sB =
        makeTerminal(
            new THREE.Vector3(
                0.75,
                0,
                0
            ),
            "switchB",
            "Switch B"
        );


    sw.add(
        sA,
        sB
    );


    sw.position.set(
        4.5,
        3.55,
        1
    );

    sw.userData.physicsPart =
        "switch";

    sw.userData.switchLever =
        lever;

    addObject(sw);

    makeDraggable(
        sw,
        "Switch"
    );


    circuitState.terminals.switchA =
        sA;

    circuitState.terminals.switchB =
        sB;

    circuitState.switchGroup =
        sw;


    setInfo(
        "Electric Circuit",
        "Drag the equipment, then click one terminal and another terminal to connect a wire. The bulb glows only when the complete circuit is correct and the switch is ON."
    );

    setStatus(
        "Connect Battery + → Switch A → Switch B → Resistor A → Resistor B → Bulb A → Bulb B → Battery -. Then switch ON."
    );


    experimentControls.innerHTML = `

        <div class="controlTitle">
            ⚡ Circuit Practical
        </div>

        <div class="controlInfo">
            1. Drag components.<br>
            2. Click two terminals to connect.<br>
            3. Complete the circuit.<br>
            4. Click the switch.
        </div>

        <button id="clearWires">
            🧹 Remove Wires
        </button>
    `;


    document.getElementById(
        "clearWires"
    ).onclick = () => {

        circuitState.wires.forEach(
            wire =>
                experimentGroup.remove(
                    wire
                )
        );

        circuitState.wires = [];
        circuitState.connections = [];
        circuitState.selectedTerminal = null;

        updateCircuit();

        setStatus(
            "Wires removed. Connect the circuit again."
        );
    };
}


function createBattery() {

    const group =
        new THREE.Group();


    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.1,
                1.55,
                0.85
            ),
            new THREE.MeshStandardMaterial({
                color: 0x111827,
                roughness: 0.35,
                metalness: 0.2
            })
        );


    group.add(body);


    const label =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.75,
                0.55,
                0.02
            ),
            new THREE.MeshStandardMaterial({
                color: 0xdc2626
            })
        );


    label.position.z =
        0.44;

    group.add(label);


    const cap =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.13,
                0.13,
                0.15,
                16
            ),
            mat(
                0xfacc15,
                {
                    metalness: 0.7
                }
            )
        );


    cap.position.y =
        0.85;

    group.add(cap);

    return group;
}


function updateCircuit() {

    if (!circuitState) return;


    const required = [

        connectionKey(
            "battery+",
            "switchA"
        ),

        connectionKey(
            "switchB",
            "resistorA"
        ),

        connectionKey(
            "resistorB",
            "bulbA"
        ),

        connectionKey(
            "bulbB",
            "battery-"
        )
    ];


    const complete =
        required.every(
            key =>
                circuitState.connections
                    .includes(key)
        );


    const closed =
        complete &&
        circuitState.switchOn;


    if (
        circuitState.bulbMaterial
    ) {

        circuitState.bulbMaterial
            .emissive.set(
                closed
                    ? 0xffa000
                    : 0x000000
            );

        circuitState.bulbMaterial
            .emissiveIntensity =
                closed
                    ? 2.5
                    : 0;

        circuitState.bulbMaterial
            .color.set(
                closed
                    ? 0xfff3b0
                    : 0xb6c2cf
            );
    }


    if (
        circuitState.switchGroup
            ?.userData
            .switchLever
    ) {

        const lever =
            circuitState
                .switchGroup
                .userData
                .switchLever;


        lever.rotation.z =
            circuitState.switchOn
                ? -0.25
                : 0.25;


        lever.material.color.set(
            circuitState.switchOn
                ? 0x22c55e
                : 0xef4444
        );
    }


    if (closed) {

        setStatus(
            "💡 Circuit complete and switch ON — bulb is glowing!"
        );

    }
    else if (
        circuitState.switchOn
    ) {

        setStatus(
            "Switch is ON, but the circuit is incomplete."
        );
    }
}


/* =========================================================
   PENDULUM
========================================================= */

function createPendulumExperiment() {

    pendulumState = {

        length: 2.5,
        running: false,
        angle: 0.55,
        time: 0,
        group: null,
        bob: null,
        string: null,
        pivot: null
    };


    const group =
        new THREE.Group();

    group.position.set(
        0,
        3,
        1
    );

    addObject(group);

    pendulumState.group =
        group;


    const base =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                5,
                0.3,
                2.2
            ),
            mat(
                0x475569,
                {
                    metalness: 0.5
                }
            )
        );


    const post =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.35,
                4.5,
                0.35
            ),
            mat(
                0x64748b,
                {
                    metalness: 0.65
                }
            )
        );


    post.position.y =
        2.4;


    const arm =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                3.8,
                0.3,
                0.35
            ),
            mat(
                0x64748b,
                {
                    metalness: 0.65
                }
            )
        );


    arm.position.set(
        1.5,
        4.5,
        0
    );


    const pivot =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.16,
                20,
                16
            ),
            mat(
                0xf59e0b,
                {
                    metalness: 0.6
                }
            )
        );


    pivot.position.set(
        3.25,
        4.5,
        0
    );


    group.add(
        base,
        post,
        arm,
        pivot
    );


    pendulumState.pivot =
        pivot;


    const string =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.025,
                0.025,
                pendulumState.length,
                12
            ),
            mat(0xe2e8f0)
        );


    group.add(string);

    pendulumState.string =
        string;


    const bob =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.38,
                28,
                20
            ),
            mat(
                0x0ea5e9,
                {
                    metalness: 0.35,
                    roughness: 0.25
                }
            )
        );


    group.add(bob);

    pendulumState.bob =
        bob;


    updatePendulumVisual();


    setInfo(
        "Simple Pendulum",
        "Change the length and start the motion. Time period is calculated using T = 2π√(L/g)."
    );


    setStatus(
        "Set the length and start the pendulum."
    );


    experimentControls.innerHTML = `

        <div class="controlTitle">
            🕰️ Pendulum
        </div>

        <div class="controlInfo">
            Length:
            <span id="pendLengthValue">
                2.5 m
            </span>
            <br>

            Time Period:
            <span id="pendPeriodValue">
                0.00 s
            </span>
        </div>

        <input
            id="pendLength"
            type="range"
            min="1"
            max="4"
            step="0.1"
            value="2.5"
        >

        <button id="pendStart">
            ▶ Start
        </button>

        <button id="pendStop">
            ⏸ Stop
        </button>

        <button id="pendReset">
            🔄 Reset Motion
        </button>
    `;


    document.getElementById(
        "pendLength"
    ).oninput = e => {

        pendulumState.length =
            Number(e.target.value);

        updatePendulumVisual();
        updatePendulumText();
    };


    document.getElementById(
        "pendStart"
    ).onclick = () => {

        pendulumState.running =
            true;

        setStatus(
            "Pendulum is moving."
        );
    };


    document.getElementById(
        "pendStop"
    ).onclick = () => {

        pendulumState.running =
            false;

        setStatus(
            "Pendulum stopped."
        );
    };


    document.getElementById(
        "pendReset"
    ).onclick = () => {

        pendulumState.time = 0;
        pendulumState.angle = 0.55;
        pendulumState.running = false;

        updatePendulumVisual();
        updatePendulumText();
    };


    updatePendulumText();
}


function updatePendulumText() {

    if (!pendulumState) return;

    const T =
        2 *
        Math.PI *
        Math.sqrt(
            pendulumState.length /
            9.81
        );


    const lengthText =
        document.getElementById(
            "pendLengthValue"
        );

    const periodText =
        document.getElementById(
            "pendPeriodValue"
        );


    if (lengthText) {

        lengthText.textContent =
            `${pendulumState.length.toFixed(1)} m`;
    }


    if (periodText) {

        periodText.textContent =
            `${T.toFixed(2)} s`;
    }
}


function updatePendulumVisual() {

    if (!pendulumState) return;


    const L =
        pendulumState.length;

    const pivot =
        pendulumState.pivot;

    const angle =
        pendulumState.angle;


    const x =
        pivot.position.x +
        Math.sin(angle) * L;

    const y =
        pivot.position.y -
        Math.cos(angle) * L;


    pendulumState.string.position
        .copy(pivot.position)
        .add(
            new THREE.Vector3(
                x,
                y,
                0
            )
        )
        .multiplyScalar(0.5);


    pendulumState.string.scale.y =
        L /
        pendulumState
            .string
            .geometry
            .parameters
            .height;


    pendulumState.string.rotation.z =
        angle;


    pendulumState.bob.position.set(
        x,
        y,
        0
    );
}


/* =========================================================
   REAL STANDARD LOGIC GATE ICON
========================================================= */

function createLogicGateIcon(type) {

    const shape =
        new THREE.Shape();


    if (type === "NOT") {

        shape.moveTo(
            -0.9,
            -0.7
        );

        shape.lineTo(
            -0.9,
            0.7
        );

        shape.lineTo(
            0.75,
            0
        );

        shape.closePath();

    }
    else if (
        type === "OR" ||
        type === "XOR"
    ) {

        shape.moveTo(
            -0.9,
            -0.7
        );

        shape.quadraticCurveTo(
            -0.35,
            0,
            -0.9,
            0.7
        );

        shape.quadraticCurveTo(
            0.25,
            0.65,
            0.95,
            0
        );

        shape.quadraticCurveTo(
            0.25,
            -0.65,
            -0.9,
            -0.7
        );

        shape.closePath();

    }
    else {

        shape.moveTo(
            -0.9,
            -0.7
        );

        shape.lineTo(
            -0.2,
            -0.7
        );

        shape.quadraticCurveTo(
            0.85,
            -0.7,
            0.95,
            0
        );

        shape.quadraticCurveTo(
            0.85,
            0.7,
            -0.2,
            0.7
        );

        shape.lineTo(
            -0.9,
            0.7
        );

        shape.closePath();
    }


    const geometry =
        new THREE.ExtrudeGeometry(
            shape,
            {
                depth: 0.35,
                bevelEnabled: true,
                bevelSegments: 2,
                bevelSize: 0.04,
                bevelThickness: 0.04
            }
        );


    geometry.center();


    const mesh =
        new THREE.Mesh(
            geometry,
            mat(
                0x475569,
                {
                    roughness: 0.35,
                    metalness: 0.15
                }
            )
        );


    mesh.rotation.x =
        Math.PI / 2;


    if (type === "XOR") {

        const curve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    -1.08,
                    -0.7,
                    0
                ),
                new THREE.Vector3(
                    -0.55,
                    0,
                    0
                ),
                new THREE.Vector3(
                    -1.08,
                    0.7,
                    0
                )
            ]);


        const lineGeometry =
            new THREE.TubeGeometry(
                curve,
                16,
                0.035,
                8,
                false
            );


        const line =
            new THREE.Mesh(
                lineGeometry,
                mat(0x94a3b8)
            );


        line.rotation.x =
            Math.PI / 2;

        line.position.z =
            0.2;


        const group =
            new THREE.Group();

        group.add(
            mesh,
            line
        );

        return group;
    }


    if (type === "NOT") {

        const bubble =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.11,
                    16,
                    12
                ),
                mat(0xf8fafc)
            );

        bubble.position.x =
            0.95;

        bubble.position.y =
            0;

        bubble.position.z =
            0.2;

        mesh.add(
            bubble
        );
    }


    return mesh;
}


/* =========================================================
   LOGIC GATES
========================================================= */

function createLogicExperiment() {

    const type =
        selectedLogicGate;

    const inputCount =
        type === "NOT"
            ? 1
            : 2;


    logicState = {

        terminals: {},
        connections: [],
        wires: [],
        selectedTerminal: null,

        inputA: false,
        inputB: false,

        ledMaterial: null,

        gateType: type,

        inputAGroup: null,
        inputBGroup: null
    };


    const gate =
        new THREE.Group();


    const icon =
        createLogicGateIcon(
            type
        );


    gate.add(icon);


    gate.position.set(
        0,
        4,
        1
    );


    gate.userData.physicsPart =
        "logicGate";


    addObject(gate);

    makeDraggable(
        gate,
        `${type} Gate`
    );


    const a =
        makeTerminal(
            new THREE.Vector3(
                -1.35,
                inputCount === 1
                    ? 0
                    : 0.35,
                0.25
            ),
            "logicA",
            "Gate Input A",
            0x22c55e
        );


    gate.add(a);

    logicState.terminals.logicA =
        a;


    if (inputCount === 2) {

        const b =
            makeTerminal(
                new THREE.Vector3(
                    -1.35,
                    -0.35,
                    0.25
                ),
                "logicB",
                "Gate Input B",
                0x22c55e
            );

        gate.add(b);

        logicState.terminals.logicB =
            b;
    }


    const out =
        makeTerminal(
            new THREE.Vector3(
                1.35,
                0,
                0.25
            ),
            "logicOut",
            "Gate Output",
            0xf59e0b
        );


    gate.add(out);

    logicState.terminals.logicOut =
        out;


    function createInput(
        name,
        x,
        z,
        id,
        stateKey
    ) {

        const group =
            new THREE.Group();


        const sphere =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.48,
                    24,
                    18
                ),
                mat(
                    0x475569,
                    {
                        metalness: 0.25
                    }
                )
            );


        const terminal =
            makeTerminal(
                new THREE.Vector3(
                    0.65,
                    0,
                    0
                ),
                id,
                name,
                0x22c55e
            );


        group.add(
            sphere,
            terminal
        );


        group.position.set(
            x,
            4,
            z
        );


        group.userData.logicInput =
            stateKey;


        addObject(group);

        makeDraggable(
            group,
            name
        );


        logicState.terminals[id] =
            terminal;


        return group;
    }


    logicState.inputAGroup =
        createInput(
            "Input A",
            -4,
            0.4,
            "inputATerm",
            "inputA"
        );


    if (inputCount === 2) {

        logicState.inputBGroup =
            createInput(
                "Input B",
                -4,
                1.8,
                "inputBTerm",
                "inputB"
            );
    }


    const led =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.45,
                24,
                18
            ),
            new THREE.MeshStandardMaterial({
                color: 0x475569,
                emissive: 0x000000,
                emissiveIntensity: 0
            })
        );


    led.position.set(
        4,
        4,
        1
    );


    addObject(led);

    makeDraggable(
        led,
        "Output LED"
    );


    const ledTerminal =
        makeTerminal(
            new THREE.Vector3(
                -0.65,
                0,
                0.25
            ),
            "ledTerm",
            "LED",
            0xf59e0b
        );


    led.add(
        ledTerminal
    );


    logicState.terminals.ledTerm =
        ledTerminal;

    logicState.ledMaterial =
        led.material;


    setInfo(
        `${type} Logic Gate`,
        `The ${type} gate uses a standard logic-gate symbol. Drag the input equipment and LED, then manually connect every terminal.`
    );


    setStatus(
        `Connect the ${type} gate manually, then toggle the input${inputCount === 2 ? "s" : ""}.`
    );


    experimentControls.innerHTML = `

        <div class="controlTitle">
            🔌 Logic Gate Practical
        </div>

        <div class="controlInfo">
            Select a gate and make all connections yourself.
            Click one terminal and then another terminal
            to create a wire.
        </div>

        <select id="gateSelector">

            <option value="AND"
                ${type === "AND" ? "selected" : ""}>
                AND Gate
            </option>

            <option value="OR"
                ${type === "OR" ? "selected" : ""}>
                OR Gate
            </option>

            <option value="XOR"
                ${type === "XOR" ? "selected" : ""}>
                XOR Gate
            </option>

            <option value="NOT"
                ${type === "NOT" ? "selected" : ""}>
                NOT Gate
            </option>

        </select>

        <button id="clearLogicWires">
            🧹 Remove Wires
        </button>
    `;


    document.getElementById(
        "gateSelector"
    ).onchange = e => {

        selectedLogicGate =
            e.target.value;

        loadPhysics(
            "logic"
        );
    };


    document.getElementById(
        "clearLogicWires"
    ).onclick = () => {

        logicState.wires.forEach(
            wire =>
                experimentGroup.remove(
                    wire
                )
        );

        logicState.wires = [];
        logicState.connections = [];
        logicState.selectedTerminal = null;

        updateLogic();

        setStatus(
            "Wires removed. Connect the gate again."
        );
    };
}


function updateLogic() {

    if (!logicState) return;


    const type =
        logicState.gateType;


    const aConnected =
        logicState.connections.includes(
            connectionKey(
                "inputATerm",
                "logicA"
            )
        );


    const bConnected =
        type === "NOT" ||
        logicState.connections.includes(
            connectionKey(
                "inputBTerm",
                "logicB"
            )
        );


    const outputConnected =
        logicState.connections.includes(
            connectionKey(
                "logicOut",
                "ledTerm"
            )
        );


    let output = false;


    if (type === "AND") {
        output =
            logicState.inputA &&
            logicState.inputB;
    }


    if (type === "OR") {
        output =
            logicState.inputA ||
            logicState.inputB;
    }


    if (type === "XOR") {
        output =
            Boolean(
                logicState.inputA
            ) !==
            Boolean(
                logicState.inputB
            );
    }


    if (type === "NOT") {
        output =
            !logicState.inputA;
    }


    const complete =
        aConnected &&
        bConnected &&
        outputConnected;


    const ledOn =
        complete &&
        output;


    logicState.ledMaterial
        .emissive.set(
            ledOn
                ? 0xffa000
                : 0x000000
        );


    logicState.ledMaterial
        .emissiveIntensity =
            ledOn
                ? 2.5
                : 0;


    logicState.ledMaterial
        .color.set(
            ledOn
                ? 0xfff3b0
                : 0x475569
        );


    if (
        logicState.inputAGroup
    ) {

        logicState.inputAGroup
            .children[0]
            .material
            .color.set(
                logicState.inputA
                    ? 0x22c55e
                    : 0x475569
            );
    }


    if (
        logicState.inputBGroup
    ) {

        logicState.inputBGroup
            .children[0]
            .material
            .color.set(
                logicState.inputB
                    ? 0x22c55e
                    : 0x475569
            );
    }


    if (ledOn) {

        setStatus(
            `💡 ${type} gate output = 1. LED is ON.`
        );

    }
    else if (complete) {

        setStatus(
            `${type} gate output = ${output ? 1 : 0}.`
        );

    }
    else {

        setStatus(
            `Connect all required wires for the ${type} gate.`
        );
    }
}


function handlePhysicsDrop(object) {

    if (
        currentExperiment ===
        "circuit"
    ) {

        setStatus(
            `${object.userData.dragLabel || "Component"} placed. Now connect its terminals.`
        );

        updateCircuit();
    }
}


/* =========================================================
   PHYSICS CLICK
========================================================= */

function handlePhysicsClick(event) {

    if (
        currentSubject !== "physics" ||
        !experimentGroup
    ) {
        return false;
    }


    updateMouse(event);

    raycaster.setFromCamera(
        mouse,
        camera
    );


    const hits =
        raycaster.intersectObjects(
            experimentGroup.children,
            true
        );


    if (!hits.length) {
        return false;
    }


    let object =
        hits[0].object;


    while (
        object &&
        object.parent !==
        experimentGroup
    ) {

        object =
            object.parent;
    }


    const terminalHit =
        hits.find(
            hit =>
                hit.object.userData &&
                hit.object.userData.terminal
        );


    if (terminalHit) {

        const terminal =
            terminalHit.object;


        const state =
            currentExperiment ===
            "circuit"
                ? circuitState
                : logicState;


        if (!state) {
            return true;
        }


        if (
            !state.selectedTerminal
        ) {

            state.selectedTerminal =
                terminal;

            terminal.material
                .emissive.set(
                    0xffa000
                );


            setStatus(
                `Selected ${terminal.userData.terminalLabel}. Click another terminal to connect.`
            );

        }
        else {

            const first =
                state.selectedTerminal;


            if (
                first !== terminal
            ) {

                connectPhysicsTerminals(
                    state,
                    first,
                    terminal
                );
            }


            first.material
                .emissive.set(
                    0x000000
                );

            terminal.material
                .emissive.set(
                    0x000000
                );


            state.selectedTerminal =
                null;


            if (
                currentExperiment ===
                "circuit"
            ) {

                updateCircuit();

            }
            else {

                updateLogic();
            }
        }


        return true;
    }


    if (
        currentExperiment ===
        "circuit" &&
        circuitState &&
        object &&
        object.userData
            .physicsPart ===
            "switch"
    ) {

        circuitState.switchOn =
            !circuitState.switchOn;

        updateCircuit();

        return true;
    }


    if (
        currentExperiment ===
        "logic" &&
        logicState &&
        object &&
        object.userData
            .logicInput
    ) {

        const key =
            object.userData.logicInput;


        logicState[key] =
            !logicState[key];


        updateLogic();

        return true;
    }


    return false;
}


/* =========================================================
   ASTRONOMY
========================================================= */

function loadAstronomy(type) {

    clearExperiment();

    currentSubject =
        "astronomy";


    if (type === "solar") {

        createSolarSystem();

    }
    else if (type === "explorer") {

        createPlanetExplorer();

    }
    else {

        createQuiz();
    }
}


/* =========================================================
   PLANET DATA
========================================================= */

const planets = [

    {
        name: "Mercury",
        radius: 0.30,
        orbit: 2.2,
        speed: 0.85,
        texture:
            "https://threejs.org/examples/textures/planets/mercury_1k.jpg",
        mass: "3.3011 × 10²³ kg",
        diameter: "4,879 km",
        rotation: "58.6 Earth days",
        orbitPeriod: "88 Earth days",
        distance: "57.9 million km",
        gravity: "3.70 m/s²",
        temperature: "−173°C to 427°C",
        moons: "0",
        type: "Rocky terrestrial planet",
        info:
            "Mercury is the smallest planet and the closest planet to the Sun. Its surface is heavily cratered."
    },

    {
        name: "Venus",
        radius: 0.43,
        orbit: 3.1,
        speed: 0.62,
        texture:
            "https://threejs.org/examples/textures/planets/venus_surface_2048.jpg",
        mass: "4.8675 × 10²⁴ kg",
        diameter: "12,104 km",
        rotation: "243 Earth days (retrograde)",
        orbitPeriod: "224.7 Earth days",
        distance: "108.2 million km",
        gravity: "8.87 m/s²",
        temperature: "~465°C",
        moons: "0",
        type: "Rocky terrestrial planet",
        info:
            "Venus has a dense carbon-dioxide atmosphere and thick clouds. It is the hottest planet."
    },

    {
        name: "Earth",
        radius: 0.47,
        orbit: 4.1,
        speed: 0.50,
        texture:
            "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
        mass: "5.9722 × 10²⁴ kg",
        diameter: "12,742 km",
        rotation: "23 h 56 min",
        orbitPeriod: "365.25 days",
        distance: "149.6 million km",
        gravity: "9.81 m/s²",
        temperature: "~14°C average",
        moons: "1",
        type: "Rocky terrestrial planet",
        info:
            "Earth has abundant surface liquid water and is the only known planet with life."
    },

    {
        name: "Mars",
        radius: 0.37,
        orbit: 5.2,
        speed: 0.40,
        texture:
            "https://threejs.org/examples/textures/planets/mars_1k_color.jpg",
        mass: "6.4171 × 10²³ kg",
        diameter: "6,779 km",
        rotation: "24 h 37 min",
        orbitPeriod: "687 Earth days",
        distance: "227.9 million km",
        gravity: "3.71 m/s²",
        temperature: "~−63°C average",
        moons: "2",
        type: "Rocky terrestrial planet",
        info:
            "Mars is a cold desert world. Iron-rich dust gives the planet its reddish appearance."
    },

    {
        name: "Jupiter",
        radius: 0.90,
        orbit: 6.6,
        speed: 0.28,
        texture:
            "https://threejs.org/examples/textures/planets/jupiter_1k.jpg",
        mass: "1.8982 × 10²⁷ kg",
        diameter: "139,820 km",
        rotation: "9 h 56 min",
        orbitPeriod: "11.86 Earth years",
        distance: "778.5 million km",
        gravity: "24.79 m/s²",
        temperature: "~−110°C cloud tops",
        moons: "95+ known",
        type: "Gas giant",
        info:
            "Jupiter is the largest planet. Its atmosphere contains bands and powerful storms including the Great Red Spot."
    },

    {
        name: "Saturn",
        radius: 0.78,
        orbit: 8.0,
        speed: 0.22,
        texture:
            "https://threejs.org/examples/textures/planets/saturn_1k.jpg",
        mass: "5.6834 × 10²⁶ kg",
        diameter: "116,460 km",
        rotation: "10 h 42 min",
        orbitPeriod: "29.45 Earth years",
        distance: "1.43 billion km",
        gravity: "10.44 m/s²",
        temperature: "~−140°C cloud tops",
        moons: "140+ known",
        type: "Gas giant",
        info:
            "Saturn is famous for its bright rings made mostly of ice and rocky particles."
    },

    {
        name: "Uranus",
        radius: 0.57,
        orbit: 9.2,
        speed: 0.17,
        texture:
            "https://threejs.org/examples/textures/planets/uranus_2k.jpg",
        mass: "8.6810 × 10²⁵ kg",
        diameter: "50,724 km",
        rotation: "17 h 14 min (retrograde)",
        orbitPeriod: "84 Earth years",
        distance: "2.87 billion km",
        gravity: "8.69 m/s²",
        temperature: "~−195°C",
        moons: "27",
        type: "Ice giant",
        info:
            "Uranus is an ice giant with a blue-green atmosphere. Its axis is tilted about 98 degrees."
    },

    {
        name: "Neptune",
        radius: 0.55,
        orbit: 10.3,
        speed: 0.14,
        texture:
            "https://threejs.org/examples/textures/planets/neptune_2k.jpg",
        mass: "1.0241 × 10²⁶ kg",
        diameter: "49,244 km",
        rotation: "16 h 6 min",
        orbitPeriod: "164.8 Earth years",
        distance: "4.50 billion km",
        gravity: "11.15 m/s²",
        temperature: "~−200°C",
        moons: "14",
        type: "Ice giant",
        info:
            "Neptune is the farthest major planet and is known for extremely strong winds."
    }
];


function planetInfoHTML(p) {

    return `

        <b>${p.name}</b>

        <br><br>

        ${p.info}

        <br><br>

        <b>Mass:</b>
        ${p.mass}

        <br>

        <b>Diameter:</b>
        ${p.diameter}

        <br>

        <b>Rotation Period:</b>
        ${p.rotation}

        <br>

        <b>Orbital Period:</b>
        ${p.orbitPeriod}

        <br>

        <b>Average Distance from Sun:</b>
        ${p.distance}

        <br>

        <b>Gravity:</b>
        ${p.gravity}

        <br>

        <b>Temperature:</b>
        ${p.temperature}

        <br>

        <b>Moons:</b>
        ${p.moons}

        <br>

        <b>Type:</b>
        ${p.type}
    `;
}


/* =========================================================
   STARS
========================================================= */

function createStars(
    count = 1200
) {

    const positions =
        new Float32Array(
            count * 3
        );


    for (
        let i = 0;
        i < count;
        i++
    ) {

        const radius =
            28 +
            Math.random() * 30;

        const angle =
            Math.random() *
            Math.PI *
            2;

        const y =
            (Math.random() - 0.5) *
            28;


        positions[i * 3] =
            Math.cos(angle) *
            radius;

        positions[i * 3 + 1] =
            y;

        positions[i * 3 + 2] =
            Math.sin(angle) *
            radius;
    }


    const geometry =
        new THREE.BufferGeometry();


    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );


    const material =
        new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.08,
            sizeAttenuation: true
        });


    return new THREE.Points(
        geometry,
        material
    );
}


function createOrbit(radius) {

    const curve =
        new THREE.EllipseCurve(
            0,
            0,
            radius,
            radius,
            0,
            Math.PI * 2,
            false,
            0
        );


    const points =
        curve.getPoints(160);


    const geometry =
        new THREE.BufferGeometry()
            .setFromPoints(
                points.map(
                    p =>
                        new THREE.Vector3(
                            p.x,
                            0,
                            p.y
                        )
                )
            );


    const material =
        new THREE.LineBasicMaterial({
            color: 0x475569,
            transparent: true,
            opacity: 0.5
        });


    const line =
        new THREE.LineLoop(
            geometry,
            material
        );


    return line;
}


/* =========================================================
   SOLAR SYSTEM
========================================================= */

function createPlanetTexture(name) {

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;

    const ctx = canvas.getContext("2d");

    /* =========================
       MERCURY
    ========================= */

    if (name === "Mercury") {

        ctx.fillStyle = "#777777";
        ctx.fillRect(0, 0, 512, 256);

        for (let i = 0; i < 120; i++) {

            const x = Math.random() * 512;
            const y = Math.random() * 256;
            const r = 1 + Math.random() * 7;

            ctx.fillStyle =
                Math.random() > 0.5
                ? "#4d4d4d"
                : "#999999";

            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* =========================
       VENUS
    ========================= */

    else if (name === "Venus") {

        const g =
            ctx.createLinearGradient(
                0, 0, 512, 256
            );

        g.addColorStop(0, "#f6d365");
        g.addColorStop(0.5, "#d99b38");
        g.addColorStop(1, "#b86b20");

        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 512, 256);

        for (let i = 0; i < 30; i++) {

            ctx.strokeStyle =
                "rgba(255,240,170,0.35)";

            ctx.lineWidth =
                4 + Math.random() * 8;

            ctx.beginPath();

            const y =
                Math.random() * 256;

            ctx.moveTo(0, y);

            ctx.bezierCurveTo(
                150,
                y - 20,
                350,
                y + 25,
                512,
                y
            );

            ctx.stroke();
        }
    }

    /* =========================
       EARTH
    ========================= */

    else if (name === "Earth") {

        ctx.fillStyle = "#1769aa";
        ctx.fillRect(0, 0, 512, 256);

        /* Continents */

        for (let i = 0; i < 18; i++) {

            const x =
                Math.random() * 512;

            const y =
                Math.random() * 256;

            const w =
                20 + Math.random() * 55;

            const h =
                10 + Math.random() * 30;

            ctx.fillStyle =
                i % 3 === 0
                ? "#7fbf4d"
                : "#3f8f3f";

            ctx.beginPath();

            ctx.ellipse(
                x,
                y,
                w,
                h,
                Math.random(),
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        /* Clouds */

        for (let i = 0; i < 20; i++) {

            ctx.strokeStyle =
                "rgba(255,255,255,0.65)";

            ctx.lineWidth = 3;

            ctx.beginPath();

            const y =
                Math.random() * 256;

            ctx.moveTo(
                Math.random() * 450,
                y
            );

            ctx.lineTo(
                Math.random() * 512,
                y + 10
            );

            ctx.stroke();
        }
    }

    /* =========================
       MARS
    ========================= */

    else if (name === "Mars") {

        ctx.fillStyle = "#a83b24";
        ctx.fillRect(0, 0, 512, 256);

        for (let i = 0; i < 100; i++) {

            const x =
                Math.random() * 512;

            const y =
                Math.random() * 256;

            const r =
                1 + Math.random() * 8;

            ctx.fillStyle =
                Math.random() > 0.5
                ? "#7f281b"
                : "#d45a35";

            ctx.beginPath();
            ctx.arc(
                x,
                y,
                r,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }
    }

    /* =========================
       JUPITER
    ========================= */

    else if (name === "Jupiter") {

        const bands = [
            "#d9b27c",
            "#a96f45",
            "#ead09b",
            "#b9784d",
            "#f0d6a2",
            "#99613f",
            "#d6a16a"
        ];

        const bandHeight =
            256 / bands.length;

        bands.forEach(
            (color, i) => {

                ctx.fillStyle = color;

                ctx.fillRect(
                    0,
                    i * bandHeight,
                    512,
                    bandHeight
                );
            }
        );

        /* Great Red Spot */

        ctx.fillStyle = "#b84c3c";

        ctx.beginPath();

        ctx.ellipse(
            365,
            170,
            55,
            25,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.strokeStyle =
            "rgba(255,230,190,0.5)";

        ctx.lineWidth = 5;

        for (let y = 20; y < 250; y += 18) {

            ctx.beginPath();

            ctx.moveTo(0, y);

            ctx.bezierCurveTo(
                150,
                y + 8,
                350,
                y - 8,
                512,
                y
            );

            ctx.stroke();
        }
    }

    /* =========================
       SATURN
    ========================= */

    else if (name === "Saturn") {

        const bands = [
            "#e4cf9a",
            "#c8ae76",
            "#f1dda9",
            "#bda26d",
            "#e8d19a"
        ];

        const h =
            256 / bands.length;

        bands.forEach(
            (color, i) => {

                ctx.fillStyle = color;

                ctx.fillRect(
                    0,
                    i * h,
                    512,
                    h
                );
            }
        );
    }

    /* =========================
       URANUS
    ========================= */

    else if (name === "Uranus") {

        const g =
            ctx.createLinearGradient(
                0,
                0,
                512,
                0
            );

        g.addColorStop(
            0,
            "#48cdd5"
        );

        g.addColorStop(
            0.5,
            "#8de5e8"
        );

        g.addColorStop(
            1,
            "#4bbac5"
        );

        ctx.fillStyle = g;
        ctx.fillRect(
            0,
            0,
            512,
            256
        );
    }

    /* =========================
       NEPTUNE
    ========================= */

    else if (name === "Neptune") {

        ctx.fillStyle =
            "#174ea6";

        ctx.fillRect(
            0,
            0,
            512,
            256
        );

        for (let i = 0; i < 15; i++) {

            ctx.strokeStyle =
                "rgba(100,190,255,0.45)";

            ctx.lineWidth = 3;

            ctx.beginPath();

            const y =
                Math.random() * 256;

            ctx.moveTo(
                0,
                y
            );

            ctx.bezierCurveTo(
                150,
                y - 10,
                350,
                y + 15,
                512,
                y
            );

            ctx.stroke();
        }
    }

    const texture =
        new THREE.CanvasTexture(canvas);

    texture.colorSpace =
        THREE.SRGBColorSpace;

    return texture;
}


function createSolarSystem() {

    solarBodies = [];
    solarOrbits = [];

    /* =========================
       STAR FIELD
    ========================= */

    const space =
        createStars();

    space.position.y = 4.5;

    addObject(space);

    /* =========================
       SOLAR SYSTEM GROUP
    ========================= */

    const system =
        new THREE.Group();

    system.position.set(
        0,
        4.6,
        1
    );

    addObject(system);

    /* =========================
       SUN
    ========================= */

    const sun =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                1.25,
                48,
                32
            ),

            new THREE.MeshBasicMaterial({
                color: 0xffa000
            })

        );

    sun.userData.planet =
        "Sun";

    system.add(sun);

    /* Sun glow */

    const sunGlow =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                1.5,
                32,
                24
            ),

            new THREE.MeshBasicMaterial({

                color: 0xff6600,

                transparent: true,

                opacity: 0.18,

                side:
                    THREE.BackSide

            })

        );

    system.add(sunGlow);

    /* =========================
       PLANETS
    ========================= */

    planets.forEach(
        (p, index) => {

            /* ORBIT */

            const orbit =
                createOrbit(
                    p.orbit
                );

            system.add(
                orbit
            );

            solarOrbits.push(
                orbit
            );

            /* =====================
               PLANET TEXTURE
            ===================== */

            const texture =
                createPlanetTexture(
                    p.name
                );

            /* =====================
               MATERIAL
            ===================== */

            const material =
                new THREE.MeshStandardMaterial({

                    map: texture,

                    color: 0xffffff,

                    roughness: 0.75,

                    metalness: 0

                });

            /* =====================
               PLANET
            ===================== */

            const planet =
                new THREE.Mesh(

                    new THREE.SphereGeometry(
                        p.radius,
                        48,
                        32
                    ),

                    material

                );

            planet.name =
                p.name;

            planet.userData.planet =
                p.name;

            planet.userData.planetData =
                p;

            planet.userData.orbit =
                p.orbit;

            planet.userData.speed =
                p.speed;

            planet.userData.phase =
                index * 0.8;

            planet.userData.originalScale =
                1;

            system.add(
                planet
            );

            solarBodies.push(
                planet
            );

            /* =====================
               SATURN RINGS
            ===================== */

            if (
                p.name === "Saturn"
            ) {

                const ring =
                    new THREE.Mesh(

                        new THREE.RingGeometry(
                            0.95,
                            1.7,
                            96
                        ),

                        new THREE.MeshBasicMaterial({

                            color:
                                0xd6bd7a,

                            transparent:
                                true,

                            opacity:
                                0.85,

                            side:
                                THREE.DoubleSide

                        })

                    );

                ring.rotation.x =
                    Math.PI / 2.25;

                ring.rotation.z =
                    0.2;

                ring.userData.parentPlanet =
                    "Saturn";

                planet.add(
                    ring
                );
            }

            /* =====================
               URANUS RINGS
            ===================== */

            if (
                p.name === "Uranus"
            ) {

                const ring =
                    new THREE.Mesh(

                        new THREE.RingGeometry(
                            0.7,
                            0.95,
                            64
                        ),

                        new THREE.MeshBasicMaterial({

                            color:
                                0x9de5eb,

                            transparent:
                                true,

                            opacity:
                                0.45,

                            side:
                                THREE.DoubleSide

                        })

                    );

                ring.rotation.x =
                    Math.PI / 2.2;

                ring.userData.parentPlanet =
                    "Uranus";

                planet.add(
                    ring
                );
            }
        }
    );

    setInfo(
        "🌌 Solar System",
        "Click or touch any planet to see its complete information."
    );

    setStatus(
        "🌌 Solar System loaded — click any planet."
    );

    experimentControls.innerHTML = `

        <div class="controlTitle">
            🌌 Solar System
        </div>

        <div class="controlInfo">

            🌑 Mercury — Gray<br>
            🟡 Venus — Yellow/Orange<br>
            🌍 Earth — Blue/Green<br>
            🔴 Mars — Red<br>
            🟠 Jupiter — Yellow/Brown<br>
            🪐 Saturn — Golden Yellow<br>
            🩵 Uranus — Cyan<br>
            🔵 Neptune — Deep Blue

        </div>

        <button id="solarResetView">
            🎯 Center Solar System
        </button>
    `;

    document
        .getElementById(
            "solarResetView"
        )
        .onclick = () => {

            controls.target.set(
                0,
                4.6,
                1
            );

            camera.position.set(
                15,
                11,
                18
            );

            controls.update();
        };
}

function animateSolarSystem(time) {

    if (!solarBodies.length) {
        return;
    }


    solarBodies.forEach(
        planet => {

            const angle =
                time *
                planet.userData.speed +
                planet.userData.phase;


            const radius =
                planet.userData.orbit;


            planet.position.x =
                Math.cos(angle) *
                radius;


            planet.position.z =
                Math.sin(angle) *
                radius;


            planet.rotation.y +=
                planet.userData
                    .rotationSpeed ||
                0.01;
        }
    );
}


/* =========================================================
   PLANET EXPLORER
========================================================= */

function createPlanetExplorer() {

    const globe =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                2,
                48,
                32
            ),
            new THREE.MeshStandardMaterial({
                map:
                    new THREE.TextureLoader()
                        .load(
                            "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg"
                        )
            })
        );


    globe.position.set(
        0,
        5,
        1
    );


    addObject(
        globe
    );


    setInfo(
        "Planet Explorer",
        "Explore the textured Earth model using the camera controls."
    );


    setStatus(
        "🌍 Planet Explorer ready."
    );
}


/* =========================================================
   QUIZ
========================================================= */

function createQuiz() {

    const questions = [

        [
            "Which planet is closest to the Sun?",
            "mercury"
        ],

        [
            "Which planet is known for its prominent rings?",
            "saturn"
        ],

        [
            "Which is the largest planet?",
            "jupiter"
        ],

        [
            "Which planet is called the Red Planet?",
            "mars"
        ],

        [
            "Which planet do we live on?",
            "earth"
        ],

        [
            "Which planet is an ice giant with a strongly tilted axis?",
            "uranus"
        ],

        [
            "Which planet is farthest from the Sun?",
            "neptune"
        ],

        [
            "Which planet has a very thick atmosphere and is extremely hot?",
            "venus"
        ],

        [
            "What is at the center of our Solar System?",
            "sun"
        ],

        [
            "How many planets are in the Solar System?",
            "8"
        ]
    ];


    const quizBox =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                4,
                1.6,
                2.2
            ),
            mat(0x1e3a5f)
        );


    quizBox.position.set(
        0,
        4,
        1
    );


    addObject(
        quizBox
    );


    let studentName = "";
    let index = 0;
    let score = 0;


    experimentControls.innerHTML = `

        <div class="controlTitle">
            🏆 Astronomy Quiz
        </div>

        <div
            id="quizNameArea"
            class="controlInfo"
        >
            Enter your name to begin.
        </div>

        <input
            id="quizName"
            placeholder="Enter your full name"
        >

        <button id="startQuiz">
            ▶ Start Quiz
        </button>

        <div
            id="quizArea"
            style="display:none"
        >

            <div
                id="quizQuestion"
                class="controlInfo"
            ></div>

            <input
                id="quizAnswer"
                placeholder="Type your answer"
            >

            <button id="quizSubmit">
                Submit Answer
            </button>

            <div
                id="quizScore"
                class="controlInfo"
            ></div>

        </div>
    `;


    const nameInput =
        document.getElementById(
            "quizName"
        );


    const startButton =
        document.getElementById(
            "startQuiz"
        );


    const quizArea =
        document.getElementById(
            "quizArea"
        );


    const question =
        document.getElementById(
            "quizQuestion"
        );


    const answer =
        document.getElementById(
            "quizAnswer"
        );


    const scoreBox =
        document.getElementById(
            "quizScore"
        );


    function showQuestion() {

        if (
            index <
            questions.length
        ) {

            question.textContent =
                `Q${index + 1}. ` +
                questions[index][0];


            scoreBox.textContent =
                `Score: ${score}/${questions.length}`;


            answer.focus();

        }
        else {

            finishQuiz();
        }
    }


    startButton.onclick = () => {

        studentName =
            nameInput.value.trim();


        if (!studentName) {

            setStatus(
                "❌ Please enter your name first."
            );

            return;
        }


        document.getElementById(
            "quizNameArea"
        ).style.display =
            "none";


        nameInput.style.display =
            "none";


        startButton.style.display =
            "none";


        quizArea.style.display =
            "block";


        setInfo(
            "Astronomy Quiz",
            `Participant: <b>${escapeHTML(studentName)}</b><br>Answer all 10 questions to receive your certificate.`
        );


        setStatus(
            `📝 Quiz started for ${studentName}.`
        );


        showQuestion();
    };


    document.getElementById(
        "quizSubmit"
    ).onclick = () => {

        if (
            index >=
            questions.length
        ) {
            return;
        }


        const userAnswer =
            answer.value
                .trim()
                .toLowerCase();


        if (!userAnswer) {

            setStatus(
                "Enter an answer first."
            );

            return;
        }


        if (
            userAnswer ===
            questions[index][1]
        ) {

            score++;

            setStatus(
                "✅ Correct answer!"
            );

        }
        else {

            setStatus(
                `❌ Incorrect. Correct answer: ${questions[index][1]}`
            );
        }


        index++;

        answer.value = "";

        showQuestion();
    };


    answer.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                document.getElementById(
                    "quizSubmit"
                ).click();
            }
        }
    );


    setInfo(
        "Astronomy Quiz",
        "Enter your name first, then answer all 10 questions. A certificate will appear after completion."
    );


    setStatus(
        "Enter your name to start the quiz."
    );


    function finishQuiz() {

        question.textContent =
            "🎉 Quiz Completed!";


        scoreBox.textContent =
            `Final Score: ${score}/${questions.length}`;


        answer.disabled = true;


        document.getElementById(
            "quizSubmit"
        ).disabled = true;


        setStatus(
            `🏆 Quiz completed by ${studentName}. Certificate generated.`
        );


        showCertificate(
            studentName,
            score,
            questions.length
        );
    }
}


/* =========================================================
   CERTIFICATE
========================================================= */

function showCertificate(
    name,
    score,
    total
) {

    const old =
        document.getElementById(
            "certificateOverlay"
        );


    if (old) {
        old.remove();
    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "certificateOverlay";


    overlay.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(2,6,23,.94);
        z-index:10000;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        overflow:auto;
    `;


    overlay.innerHTML = `

        <div
            id="certificate"
            style="
                width:min(900px,95vw);
                background:white;
                color:#0f172a;
                border:12px double #1e3a8a;
                padding:45px;
                text-align:center;
                box-shadow:0 20px 60px rgba(0,0,0,.5);
                font-family:Georgia,serif;
            "
        >

            <div
                style="
                    font-size:20px;
                    letter-spacing:4px;
                    color:#1e3a8a;
                "
            >
                VIRTUAL SCIENCE LAB 3D
            </div>


            <h1
                style="
                    font-size:44px;
                    margin:18px 0 8px;
                    color:#0f172a;
                "
            >
                Certificate of Achievement
            </h1>


            <p
                style="
                    font-size:18px;
                "
            >
                This certificate is proudly presented to
            </p>


            <h2
                style="
                    font-size:36px;
                    margin:14px 0;
                    color:#1e3a8a;
                "
            >
                ${escapeHTML(name)}
            </h2>


            <p
                style="
                    font-size:18px;
                "
            >
                for successfully completing the
                Astronomy Quiz
            </p>


            <div
                style="
                    font-size:28px;
                    font-weight:bold;
                    margin:22px 0;
                "
            >
                Score: ${score} / ${total}
            </div>


            <p>
                Interactive Virtual Learning Laboratory
            </p>


            <div
                style="
                    margin-top:35px;
                    display:flex;
                    justify-content:space-between;
                    font-size:13px;
                "
            >
                <span>
                    Virtual Science Lab 3D
                </span>

                <span>
                    ${new Date().toLocaleDateString()}
                </span>
            </div>

        </div>


        <div
            style="
                position:fixed;
                bottom:20px;
                display:flex;
                gap:10px;
            "
        >

            <button
                id="printCertificate"
                style="
                    padding:12px 18px;
                    border:0;
                    border-radius:8px;
                    background:#2563eb;
                    color:white;
                    font-weight:bold;
                    cursor:pointer;
                "
            >
                🖨 Print / Save Certificate
            </button>


            <button
                id="closeCertificate"
                style="
                    padding:12px 18px;
                    border:0;
                    border-radius:8px;
                    background:#475569;
                    color:white;
                    font-weight:bold;
                    cursor:pointer;
                "
            >
                ✕ Close
            </button>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    document.getElementById(
        "printCertificate"
    ).onclick = () => {

        const certificate =
            document.getElementById(
                "certificate"
            ).outerHTML;


        const printWindow =
            window.open(
                "",
                "_blank"
            );


        if (!printWindow) {

            setStatus(
                "Please allow pop-ups to print the certificate."
            );

            return;
        }


        printWindow.document.write(`
            <html>
                <head>
                    <title>
                        Science Lab Certificate
                    </title>
                </head>

                <body
                    style="
                        margin:30px;
                        background:white;
                    "
                >
                    ${certificate}
                </body>
            </html>
        `);


        printWindow.document.close();

        printWindow.focus();


        setTimeout(
            () => printWindow.print(),
            300
        );
    };


    document.getElementById(
        "closeCertificate"
    ).onclick = () => {

        overlay.remove();
    };
}


function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value;

    return div.innerHTML;
}


/* =========================================================
   EXPERIMENT MENU
========================================================= */

const experimentData = {

    physics: [
        [
            "circuit",
            "⚡ Electric Circuit"
        ],
        [
            "pendulum",
            "⏱ Simple Pendulum"
        ],
        [
            "logic",
            "🔌 Logic Gates"
        ]
    ],


    biology: [
        [
            "plant",
            "🌱 Plant Cell"
        ],
        [
            "animal",
            "🧬 Animal Cell"
        ],
        [
            "photosynthesis",
            "☀ Photosynthesis"
        ]
    ],


    chemistry: [
        [
            "ph",
            "🧪 Hands-on pH"
        ],
        [
            "filtration",
            "🧻 Filtration"
        ],
        [
            "reaction",
            "⚗ Reaction Observation"
        ]
    ],


    astronomy: [
        [
            "solar",
            "🌌 Solar System"
        ],
        [
            "explorer",
            "🌍 Planet Explorer"
        ],
        [
            "quiz",
            "❓ Astronomy Quiz"
        ]
    ]
};


/* =========================================================
   SUBJECT BUTTONS
========================================================= */

document.querySelectorAll(
    ".subjectBtn"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            const subject =
                button.dataset.subject;


            currentSubject =
                subject;


            document.querySelectorAll(
                ".subjectBtn"
            ).forEach(btn => {

                btn.classList.remove(
                    "active"
                );
            });


            button.classList.add(
                "active"
            );


            showExperiments(
                subject
            );
        }
    );
});


function showExperiments(
    subject
) {

    experimentTitle.textContent =
        `${subject.toUpperCase()} Experiments`;


    experimentButtons.innerHTML =
        "";


    experimentData[
        subject
    ].forEach(item => {

        const button =
            document.createElement(
                "button"
            );


        button.className =
            "experimentBtn";


        button.textContent =
            item[1];


        button.onclick = () => {

            document.querySelectorAll(
                ".experimentBtn"
            ).forEach(btn => {

                btn.classList.remove(
                    "active"
                );
            });


            button.classList.add(
                "active"
            );


            openExperiment(
                subject,
                item[0]
            );
        };


        experimentButtons.appendChild(
            button
        );
    });
}


/* =========================================================
   OPEN EXPERIMENT
========================================================= */

function openExperiment(
    subject,
    experiment
) {

    currentSubject =
        subject;

    currentExperiment =
        experiment;


    if (subject === "physics") {

        loadPhysics(
            experiment
        );

    }
    else if (
        subject === "biology"
    ) {

        loadBiology(
            experiment
        );

    }
    else if (
        subject === "chemistry"
    ) {

        loadChemistry(
            experiment
        );

    }
    else if (
        subject === "astronomy"
    ) {

        loadAstronomy(
            experiment
        );
    }
}


/* =========================================================
   HOME
========================================================= */

document.getElementById(
    "homeBtn"
).onclick = () => {

    clearExperiment();

    currentSubject = null;
    currentExperiment = null;

    experimentTitle.textContent =
        "Select an Experiment";

    experimentButtons.innerHTML =
        "";

    experimentControls.innerHTML =
        "";


    setInfo(
        "Virtual Science Lab",
        "Select Physics, Biology, Chemistry or Astronomy to start."
    );


    setStatus(
        "Welcome to the Virtual Science Lab."
    );
};


/* =========================================================
   CLEAR TABLE
========================================================= */

document.getElementById(
    "clearTable"
).onclick = () => {

    if (!experimentGroup) return;


    experimentGroup.children
        .slice()
        .forEach(obj => {

            experimentGroup.remove(
                obj
            );
        });


    draggableObjects.length = 0;


    setStatus(
        "Table cleared."
    );
};


/* =========================================================
   RESET
========================================================= */

document.getElementById(
    "reset"
).onclick = () => {

    if (
        currentSubject &&
        currentExperiment
    ) {

        openExperiment(
            currentSubject,
            currentExperiment
        );

    }
    else {

        location.reload();
    }
};


/* =========================================================
   PHYSICS CLICK
========================================================= */

renderer.domElement.addEventListener(
    "click",
    event => {

        if (
            handlePhysicsClick(
                event
            )
        ) {
            return;
        }
    }
);


/* =========================================================
   PLANET CLICK
========================================================= */

renderer.domElement.addEventListener(
    "click",
    event => {

        if (
            currentSubject !==
            "astronomy"
        ) {
            return;
        }


        if (
            currentExperiment !==
            "solar"
        ) {
            return;
        }


        updateMouse(event);


        raycaster.setFromCamera(
            mouse,
            camera
        );


        const hits =
            raycaster.intersectObjects(
                experimentGroup.children,
                true
            );


        if (!hits.length) {
            return;
        }


        let object =
            hits[0].object;


        while (
            object &&
            object.parent !==
            experimentGroup
        ) {

            object =
                object.parent;
        }


        if (
            object &&
            object.userData &&
            object.userData.planet
        ) {

            setInfo(
                object.userData.planet,
                object.userData.planetInfo
            );


            setStatus(
                `🌌 ${object.userData.planet} selected.`
            );
        }
    }
);


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();


        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);


/* =========================================================
   ANIMATION
========================================================= */

function animate() {

    requestAnimationFrame(
        animate
    );


    const delta =
        clock.getDelta();

    const time =
        clock.elapsedTime;


    /* SOLAR SYSTEM */

    if (
        currentSubject ===
        "astronomy" &&
        currentExperiment ===
        "solar"
    ) {

        animateSolarSystem(
            time
        );
    }


    /* PENDULUM */

    if (
        currentSubject ===
        "physics" &&
        currentExperiment ===
        "pendulum" &&
        pendulumState
    ) {

        if (
            pendulumState.running
        ) {

            pendulumState.time +=
                delta;


            const period =
                2 *
                Math.PI *
                Math.sqrt(
                    pendulumState.length /
                    9.81
                );


            pendulumState.angle =
                0.55 *
                Math.cos(
                    (2 * Math.PI / period) *
                    pendulumState.time
                );


            updatePendulumVisual();
        }


        updatePendulumText();
    }


    /* PH METER */

    if (
        chemistryBeaker &&
        chemistryBeaker.userData.meter
    ) {

        const meter =
            chemistryBeaker.userData.meter;


        const value =
            meter.userData.value;


        if (
            value !== undefined
        ) {

            let textMesh =
                meter.userData.textMesh;


            if (!textMesh) {

                const canvas =
                    document.createElement(
                        "canvas"
                    );


                canvas.width = 256;
                canvas.height = 128;


                const ctx =
                    canvas.getContext(
                        "2d"
                    );


                ctx.fillStyle =
                    "#0f172a";

                ctx.fillRect(
                    0,
                    0,
                    256,
                    128
                );


                ctx.fillStyle =
                    "#22c55e";

                ctx.font =
                    "bold 48px Arial";

                ctx.textAlign =
                    "center";


                ctx.fillText(
                    `pH ${value}`,
                    128,
                    78
                );


                const texture =
                    new THREE.CanvasTexture(
                        canvas
                    );


                textMesh =
                    new THREE.Mesh(
                        new THREE.PlaneGeometry(
                            1,
                            0.5
                        ),
                        new THREE.MeshBasicMaterial({
                            map: texture
                        })
                    );


                textMesh.position.set(
                    0,
                    0,
                    0.28
                );


                meter.add(
                    textMesh
                );


                meter.userData.textMesh =
                    textMesh;

            }
            else {

                const canvas =
                    textMesh.material
                        .map
                        .image;


                const ctx =
                    canvas.getContext(
                        "2d"
                    );


                ctx.clearRect(
                    0,
                    0,
                    256,
                    128
                );


                ctx.fillStyle =
                    "#0f172a";

                ctx.fillRect(
                    0,
                    0,
                    256,
                    128
                );


                ctx.fillStyle =
                    value < 7
                        ? "#f87171"
                        : value > 7
                            ? "#60a5fa"
                            : "#22c55e";


                ctx.font =
                    "bold 48px Arial";

                ctx.textAlign =
                    "center";


                ctx.fillText(
                    `pH ${value}`,
                    128,
                    78
                );


                textMesh.material
                    .map
                    .needsUpdate =
                    true;
            }
        }
    }


    /* PHOTOSYNTHESIS OXYGEN */

    if (
        window.photoState &&
        window.photoState.started &&
        window.photoState.bubbles
    ) {

        window.photoState.bubbles
            .forEach(
                (bubble, index) => {

                    bubble.position.y +=
                        delta *
                        (0.35 +
                        index * 0.015);


                    bubble.position.x +=
                        Math.sin(
                            time * 2 +
                            index
                        ) *
                        delta *
                        0.08;


                    if (
                        bubble.position.y >
                        6.2
                    ) {

                        bubble.position.y =
                            3.6;
                    }
                }
            );
    }


    /* REACTION BUBBLES */

    if (experimentGroup) {

        experimentGroup.children
            .forEach(
                object => {

                    if (
                        object.userData &&
                        object.userData
                            .reactionBubble
                    ) {

                        object.position.y +=
                            delta * 0.4;


                        if (
                            object.position.y >
                            6
                        ) {

                            object.position.y =
                                4;
                        }
                    }
                }
            );
    }


    controls.update();

    renderer.render(
        scene,
        camera
    );
}


animate();

/* =========================================================
   FINAL ENHANCEMENTS
   Biology + Logic Gates + Chemistry
   Existing experiments remain unchanged
========================================================= */

function __labTextSprite(text, color = "#ffffff") {

    const canvas = document.createElement("canvas");

    canvas.width = 700;
    canvas.height = 110;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle = "rgba(2,6,23,0.88)";

    ctx.beginPath();

    ctx.roundRect(
        6,
        6,
        688,
        98,
        18
    );

    ctx.fill();

    ctx.fillStyle = color;

    ctx.font = "bold 34px Arial";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        text,
        350,
        55
    );

    const texture =
        new THREE.CanvasTexture(canvas);

    texture.colorSpace =
        THREE.SRGBColorSpace;

    const sprite =
        new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false
            })
        );

    sprite.scale.set(
        2.35,
        0.37,
        1
    );

    sprite.renderOrder = 100;

    return sprite;
}


function __addOrganelleLabel(
    group,
    text,
    x,
    y,
    z
) {

    const label =
        __labTextSprite(text);

    label.position.set(
        x,
        y,
        z
    );

    label.userData.organelleLabel =
        true;

    group.add(label);

    return label;
}


function __setBioLabels(
    group,
    visible
) {

    group.traverse(
        obj => {

            if (
                obj.userData &&
                obj.userData.organelleLabel
            ) {

                obj.visible =
                    visible;
            }
        }
    );
}


/* =========================================================
   PLANT CELL
========================================================= */

createPlantCell = function () {

    const group =
        new THREE.Group();


    const wall =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                1.55,
                40,
                28
            ),

            new THREE.MeshStandardMaterial({
                color: 0x22c55e,
                transparent: true,
                opacity: 0.14,
                wireframe: true
            })
        );

    group.add(wall);


    const membrane =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                1.48,
                40,
                28
            ),

            new THREE.MeshStandardMaterial({
                color: 0x86efac,
                transparent: true,
                opacity: 0.16,
                wireframe: true
            })
        );

    group.add(membrane);


    /* VACUOLE */

    const vacuole =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.68,
                28,
                20
            ),

            new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.30
            })
        );

    vacuole.scale.set(
        1.15,
        0.9,
        0.75
    );

    vacuole.position.set(
        0.18,
        0.1,
        -0.05
    );

    group.add(vacuole);


    /* NUCLEUS */

    const nucleus =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.42,
                28,
                20
            ),

            mat(0x7c3aed)
        );

    nucleus.position.set(
        -0.42,
        0.25,
        0.45
    );

    group.add(nucleus);


    /* NUCLEOLUS */

    const nucleolus =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.13,
                20,
                14
            ),

            mat(0xf0abfc)
        );

    nucleolus.position.set(
        -0.52,
        0.30,
        0.78
    );

    group.add(nucleolus);


    /* CHLOROPLASTS */

    for (
        let i = 0;
        i < 8;
        i++
    ) {

        const angle =
            i *
            Math.PI *
            2 /
            8;

        const chloroplast =
            new THREE.Mesh(

                new THREE.SphereGeometry(
                    0.16,
                    18,
                    12
                ),

                mat(0x16a34a)
            );

        chloroplast.scale.set(
            1.25,
            0.7,
            0.7
        );

        chloroplast.position.set(
            Math.cos(angle) * 0.95,
            Math.sin(angle) * 0.72,
            0.28 * Math.sin(angle * 2)
        );

        group.add(
            chloroplast
        );
    }


    /* MITOCHONDRIA */

    const mitoPositions = [

        [0.72, 0.65, 0.35],

        [-0.9, -0.55, 0.35],

        [0.85, -0.55, -0.15]

    ];


    mitoPositions.forEach(
        position => {

            const mito =
                new THREE.Mesh(

                    new THREE.SphereGeometry(
                        0.14,
                        18,
                        12
                    ),

                    mat(0xef4444)
                );

            mito.scale.set(
                1.5,
                0.65,
                0.7
            );

            mito.position.set(
                ...position
            );

            group.add(mito);
        }
    );


    /* RIBOSOMES */

    for (
        let i = 0;
        i < 10;
        i++
    ) {

        const angle =
            i *
            Math.PI *
            2 /
            10;

        const ribosome =
            new THREE.Mesh(

                new THREE.SphereGeometry(
                    0.045,
                    10,
                    8
                ),

                mat(0xfacc15)
            );

        ribosome.position.set(
            Math.cos(angle) * 1.05,
            Math.sin(angle) * 1.05 * 0.78,
            0.45
        );

        group.add(
            ribosome
        );
    }


    /* GOLGI BODY */

    const golgi =
        new THREE.Group();


    for (
        let i = 0;
        i < 4;
        i++
    ) {

        const g =
            new THREE.Mesh(

                new THREE.TorusGeometry(
                    0.20 - i * 0.025,
                    0.025,
                    8,
                    20,
                    Math.PI
                ),

                mat(0xf97316)
            );

        g.rotation.x =
            Math.PI / 2;

        g.position.set(
            0.65 - i * 0.03,
            0.05,
            0.55 + i * 0.04
        );

        golgi.add(g);
    }

    group.add(golgi);


    /* ENDOPLASMIC RETICULUM */

    const er =
        new THREE.Group();


    for (
        let i = 0;
        i < 3;
        i++
    ) {

        const e =
            new THREE.Mesh(

                new THREE.TorusGeometry(
                    0.25 + i * 0.06,
                    0.018,
                    8,
                    24,
                    Math.PI * 1.5
                ),

                mat(0x38bdf8)
            );

        e.rotation.x =
            Math.PI / 2;

        e.position.set(
            -0.75 + i * 0.12,
            -0.25,
            0.55
        );

        er.add(e);
    }

    group.add(er);


    /* LABELS */

    __addOrganelleLabel(
        group,
        "Cell Wall",
        0,
        1.85,
        0
    );

    __addOrganelleLabel(
        group,
        "Cell Membrane",
        0,
        -1.85,
        0
    );

    __addOrganelleLabel(
        group,
        "Nucleus",
        -0.45,
        0.72,
        0.85
    );

    __addOrganelleLabel(
        group,
        "Nucleolus",
        -0.52,
        0.02,
        1.05
    );

    __addOrganelleLabel(
        group,
        "Chloroplast",
        1.05,
        0.95,
        0.45
    );

    __addOrganelleLabel(
        group,
        "Vacuole",
        0.55,
        0.1,
        0.8
    );

    __addOrganelleLabel(
        group,
        "Mitochondria",
        -1.0,
        -0.85,
        0.55
    );

    __addOrganelleLabel(
        group,
        "Ribosomes",
        1.05,
        -1.15,
        0.45
    );

    __addOrganelleLabel(
        group,
        "Golgi Body",
        1.25,
        0.25,
        0.7
    );

    __addOrganelleLabel(
        group,
        "Endoplasmic Reticulum",
        -1.25,
        0.25,
        0.7
    );


    __setBioLabels(
        group,
        false
    );


    return group;
};


/* =========================================================
   ANIMAL CELL
========================================================= */

createAnimalCell = function () {

    const group =
        new THREE.Group();


    const membrane =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                1.55,
                40,
                28
            ),

            new THREE.MeshStandardMaterial({
                color: 0xf9a8d4,
                transparent: true,
                opacity: 0.20,
                wireframe: true
            })
        );

    group.add(membrane);


    const nucleus =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.48,
                28,
                20
            ),

            mat(0x7c3aed)
        );

    nucleus.position.set(
        -0.25,
        0.15,
        0.4
    );

    group.add(nucleus);


    const nucleolus =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.14,
                20,
                14
            ),

            mat(0xf0abfc)
        );

    nucleolus.position.set(
        -0.32,
        0.18,
        0.75
    );

    group.add(nucleolus);


    const mitoPositions = [

        [0.7, 0.65, 0.25],

        [-0.85, -0.45, 0.25],

        [0.9, -0.5, -0.2],

        [-0.85, 0.65, -0.15]

    ];


    mitoPositions.forEach(
        position => {

            const mito =
                new THREE.Mesh(

                    new THREE.SphereGeometry(
                        0.15,
                        18,
                        12
                    ),

                    mat(0xef4444)
                );

            mito.scale.set(
                1.5,
                0.65,
                0.7
            );

            mito.position.set(
                ...position
            );

            group.add(mito);
        }
    );


    /* RIBOSOMES */

    for (
        let i = 0;
        i < 10;
        i++
    ) {

        const angle =
            i *
            Math.PI *
            2 /
            10;

        const ribosome =
            new THREE.Mesh(

                new THREE.SphereGeometry(
                    0.045,
                    10,
                    8
                ),

                mat(0xfacc15)
            );

        ribosome.position.set(
            Math.cos(angle) * 1.0,
            Math.sin(angle) * 1.0 * 0.75,
            0.42
        );

        group.add(
            ribosome
        );
    }


    /* GOLGI */

    const golgi =
        new THREE.Group();


    for (
        let i = 0;
        i < 4;
        i++
    ) {

        const g =
            new THREE.Mesh(

                new THREE.TorusGeometry(
                    0.2 - i * 0.025,
                    0.025,
                    8,
                    20,
                    Math.PI
                ),

                mat(0xf97316)
            );

        g.rotation.x =
            Math.PI / 2;

        g.position.set(
            0.75 - i * 0.03,
            0,
            0.55 + i * 0.04
        );

        golgi.add(g);
    }

    group.add(golgi);


    /* ER */

    const er =
        new THREE.Group();


    for (
        let i = 0;
        i < 3;
        i++
    ) {

        const e =
            new THREE.Mesh(

                new THREE.TorusGeometry(
                    0.25 + i * 0.06,
                    0.018,
                    8,
                    24,
                    Math.PI * 1.5
                ),

                mat(0x38bdf8)
            );

        e.rotation.x =
            Math.PI / 2;

        e.position.set(
            -0.75 + i * 0.12,
            -0.25,
            0.55
        );

        er.add(e);
    }

    group.add(er);


    /* LYSOSOMES */

    const lysosomes = [

        [0.25, -0.85, 0.35],

        [-0.35, -0.8, 0.25]

    ];


    lysosomes.forEach(
        position => {

            const lysosome =
                new THREE.Mesh(

                    new THREE.SphereGeometry(
                        0.10,
                        16,
                        12
                    ),

                    mat(0xf43f5e)
                );

            lysosome.position.set(
                ...position
            );

            group.add(
                lysosome
            );
        }
    );


    /* LABELS */

    __addOrganelleLabel(
        group,
        "Cell Membrane",
        0,
        -1.85,
        0
    );

    __addOrganelleLabel(
        group,
        "Nucleus",
        -0.25,
        0.75,
        0.85
    );

    __addOrganelleLabel(
        group,
        "Nucleolus",
        -0.32,
        0.05,
        1.05
    );

    __addOrganelleLabel(
        group,
        "Mitochondria",
        1.0,
        0.85,
        0.5
    );

    __addOrganelleLabel(
        group,
        "Ribosomes",
        1.05,
        -1.05,
        0.5
    );

    __addOrganelleLabel(
        group,
        "Golgi Body",
        1.25,
        0.25,
        0.7
    );

    __addOrganelleLabel(
        group,
        "Endoplasmic Reticulum",
        -1.35,
        0.25,
        0.7
    );

    __addOrganelleLabel(
        group,
        "Lysosome",
        0.55,
        -1.05,
        0.8
    );


    __setBioLabels(
        group,
        false
    );


    return group;
};


/* =========================================================
   BIOLOGY CONTROLS
========================================================= */

addBiologyControls =
function (
    name,
    cellView
) {

    experimentControls.innerHTML = `

        <div class="controlTitle">
            🔬 ${name} Microscope
        </div>

        <div class="controlInfo">

            <b>Procedure</b><br>

            1. Drag the slide onto the
            green microscope stage.<br>

            2. Click Observe Slide.<br>

            3. Use Zoom In to inspect
            organelles.<br>

            4. Use Zoom Out or Reset Zoom.

        </div>

        <button id="observeBtn">
            🔬 Observe Slide
        </button>

        <button id="zoomIn">
            🔍 Zoom In
        </button>

        <button id="zoomOut">
            🔎 Zoom Out
        </button>

        <button id="resetBioZoom">
            🔄 Reset Zoom
        </button>

        <div
            id="bioZoomInfo"
            class="controlInfo"
        >
            Zoom: 1.00×<br>
            Organelles appear clearly
            at higher magnification.
        </div>

        <div class="controlInfo">

            <b>Cell Structures</b><br>

            Plant:
            Cell Wall,
            Cell Membrane,
            Nucleus,
            Chloroplast,
            Vacuole,
            Mitochondria,
            Ribosomes,
            Golgi Body,
            ER.<br><br>

            Animal:
            Cell Membrane,
            Nucleus,
            Nucleolus,
            Mitochondria,
            Ribosomes,
            Golgi Body,
            ER,
            Lysosome.

        </div>
    `;


    let zoom = 1;


    function updateZoom() {

        cellView.scale.set(
            zoom,
            zoom,
            zoom
        );


        __setBioLabels(
            cellView,
            zoom >= 1.35 &&
            cellView.visible
        );


        const box =
            document.getElementById(
                "bioZoomInfo"
            );


        if (box) {

            box.innerHTML =

                `Zoom:
                <b>${zoom.toFixed(2)}×</b><br>` +

                (
                    zoom >= 1.35

                        ? "🔬 Organelle labels are visible."

                        : "Zoom in to reveal organelle names."
                );
        }
    }


    document.getElementById(
        "observeBtn"
    ).onclick = () => {

        if (!slideOnStage) {

            setStatus(
                "❌ First drag the slide onto the microscope stage."
            );

            return;
        }


        cellView.visible = true;

        zoom = 1;

        updateZoom();


        setStatus(
            "✅ Slide observed. Zoom in to inspect the cell organelles."
        );
    };


    document.getElementById(
        "zoomIn"
    ).onclick = () => {

        if (!cellView.visible) {

            setStatus(
                "❌ First observe the slide."
            );

            return;
        }


        zoom =
            Math.min(
                3,
                zoom + 0.25
            );

        updateZoom();


        setStatus(
            `🔍 Microscope zoom:
            ${zoom.toFixed(2)}×`
        );
    };


    document.getElementById(
        "zoomOut"
    ).onclick = () => {

        if (!cellView.visible) {

            setStatus(
                "❌ First observe the slide."
            );

            return;
        }


        zoom =
            Math.max(
                0.75,
                zoom - 0.25
            );

        updateZoom();


        setStatus(
            `🔎 Microscope zoom:
            ${zoom.toFixed(2)}×`
        );
    };


    document.getElementById(
        "resetBioZoom"
    ).onclick = () => {

        if (!cellView.visible) {

            setStatus(
                "❌ First observe the slide."
            );

            return;
        }


        zoom = 1;

        updateZoom();


        setStatus(
            "🔄 Microscope zoom reset to 1×."
        );
    };
};


/* =========================================================
   REAL STANDARD LOGIC GATES
========================================================= */

createLogicGateIcon =
function (type) {

    const group =
        new THREE.Group();

    const shape =
        new THREE.Shape();


    if (
        type === "AND" ||
        type === "NAND"
    ) {

        shape.moveTo(
            -0.85,
            -0.65
        );

        shape.lineTo(
            0,
            -0.65
        );

        shape.absarc(
            0,
            0,
            0.65,
            -Math.PI / 2,
            Math.PI / 2,
            false
        );

        shape.lineTo(
            -0.85,
            0.65
        );

        shape.closePath();

    }

    else if (
        type === "OR" ||
        type === "NOR" ||
        type === "XOR"
    ) {

        shape.moveTo(
            -0.9,
            -0.65
        );

        shape.quadraticCurveTo(
            -0.35,
            -0.05,
            0.8,
            0
        );

        shape.quadraticCurveTo(
            -0.35,
            0.05,
            -0.9,
            0.65
        );

        shape.quadraticCurveTo(
            -0.35,
            0.05,
            -0.9,
            -0.65
        );

        shape.closePath();

    }

    else {

        shape.moveTo(
            -0.9,
            -0.65
        );

        shape.lineTo(
            -0.9,
            0.65
        );

        shape.lineTo(
            0.75,
            0
        );

        shape.closePath();
    }


    const mesh =
        new THREE.Mesh(

            shape,

            new THREE.MeshStandardMaterial({
                color: 0x0f766e,
                roughness: 0.38,
                metalness: 0.18,
                side: THREE.DoubleSide
            })
        );

    group.add(mesh);


    const outline =
        new THREE.LineLoop(

            new THREE.BufferGeometry()
                .setFromPoints(

                    shape
                        .getPoints(48)
                        .map(
                            p =>
                                new THREE.Vector3(
                                    p.x,
                                    p.y,
                                    0.03
                                )
                        )
                ),

            new THREE.LineBasicMaterial({
                color: 0xe2e8f0
            })
        );

    group.add(
        outline
    );


    /* XOR / XNOR EXTRA CURVE */

    if (
        type === "XOR" ||
        type === "XNOR"
    ) {

        const curve =
            new THREE.EllipseCurve(
                -0.92,
                0,
                0.25,
                0.65,
                Math.PI / 2,
                3 * Math.PI / 2,
                false,
                0
            );


        const points =
            curve
                .getPoints(32)
                .map(
                    p =>
                        new THREE.Vector3(
                            p.x,
                            p.y,
                            0.04
                        )
                );


        group.add(

            new THREE.Line(

                new THREE.BufferGeometry()
                    .setFromPoints(
                        points
                    ),

                new THREE.LineBasicMaterial({
                    color: 0xe2e8f0
                })
            )
        );
    }


    /* NAND / NOR / XNOR OUTPUT BUBBLE */

    if (
        type === "NAND" ||
        type === "NOR" ||
        type === "XNOR"
    ) {

        const bubble =
            new THREE.Mesh(

                new THREE.SphereGeometry(
                    0.13,
                    18,
                    12
                ),

                new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.25
                })
            );

        bubble.position.x =
            0.93;

        bubble.position.z =
            0.05;

        group.add(
            bubble
        );
    }


    const label =
        __labTextSprite(
            type,
            "#e2e8f0"
        );

    label.scale.set(
        1.4,
        0.22,
        1
    );

    label.position.set(
        0,
        -0.95,
        0.1
    );

    group.add(
        label
    );


    return group;
};


/* =========================================================
   LOGIC GATE SIDE LIBRARY
========================================================= */

const __oldCreateLogicExperiment =
    createLogicExperiment;


createLogicExperiment =
function () {

    __oldCreateLogicExperiment();


    const type =
        selectedLogicGate;


    experimentControls.innerHTML = `

        <div class="controlTitle">
            🔌 Logic Gate Practical
        </div>

        <div class="controlInfo">

            <b>Student Wiring</b><br>

            1. Choose a logic gate.<br>

            2. Click one terminal.<br>

            3. Click another terminal
            to make the wire.<br>

            4. Connect every required
            input and the output LED.<br>

            5. Toggle Input A/B
            to test the gate.

        </div>

        <div class="controlTitle">
            Gate Library
        </div>

        <div
            id="logicGateList"
            style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:6px;
            "
        ></div>

        <button id="clearLogicWires">
            🧹 Remove Wires
        </button>
    `;


    const list =
        document.getElementById(
            "logicGateList"
        );


    [
        "AND",
        "OR",
        "NOT",
        "NAND",
        "NOR",
        "XOR",
        "XNOR"
    ].forEach(
        gate => {

            const button =
                document.createElement(
                    "button"
                );

            button.textContent =
                (
                    gate === type
                        ? "✓ "
                        : ""
                ) +
                gate +
                " Gate";

            button.style.textAlign =
                "left";


            button.onclick = () => {

                selectedLogicGate =
                    gate;

                loadPhysics(
                    "logic"
                );
            };


            list.appendChild(
                button
            );
        }
    );


    document.getElementById(
        "clearLogicWires"
    ).onclick = () => {

        if (!logicState) {
            return;
        }


        logicState.wires.forEach(
            wire =>
                experimentGroup.remove(
                    wire
                )
        );


        logicState.wires = [];

        logicState.connections = [];

        logicState.selectedTerminal =
            null;


        updateLogic();


        setStatus(
            "Wires removed. Connect the gate again."
        );
    };
};


/* =========================================================
   LOGIC CALCULATION
========================================================= */

updateLogic =
function () {

    if (!logicState) {
        return;
    }


    const type =
        logicState.gateType;


    const aConnected =
        logicState.connections.includes(
            connectionKey(
                "inputATerm",
                "logicA"
            )
        );


    const bConnected =
        type === "NOT" ||

        logicState.connections.includes(
            connectionKey(
                "inputBTerm",
                "logicB"
            )
        );


    const outputConnected =
        logicState.connections.includes(
            connectionKey(
                "logicOut",
                "ledTerm"
            )
        );


    let output = false;


    if (
        type === "AND"
    ) {

        output =
            logicState.inputA &&
            logicState.inputB;

    }

    else if (
        type === "OR"
    ) {

        output =
            logicState.inputA ||
            logicState.inputB;

    }

    else if (
        type === "XOR"
    ) {

        output =
            Boolean(
                logicState.inputA
            ) !==
            Boolean(
                logicState.inputB
            );

    }

    else if (
        type === "NAND"
    ) {

        output =
            !(
                logicState.inputA &&
                logicState.inputB
            );

    }

    else if (
        type === "NOR"
    ) {

        output =
            !(
                logicState.inputA ||
                logicState.inputB
            );

    }

    else if (
        type === "XNOR"
    ) {

        output =
            Boolean(
                logicState.inputA
            ) ===
            Boolean(
                logicState.inputB
            );

    }

    else if (
        type === "NOT"
    ) {

        output =
            !logicState.inputA;
    }


    const complete =
        aConnected &&
        bConnected &&
        outputConnected;


    const ledOn =
        complete &&
        output;


    logicState.ledMaterial
        .emissive
        .set(
            ledOn
                ? 0xffa000
                : 0x000000
        );


    logicState
        .ledMaterial
        .emissiveIntensity =
            ledOn
                ? 2.5
                : 0;


    logicState
        .ledMaterial
        .color
        .set(
            ledOn
                ? 0xfff3b0
                : 0x475569
        );


    if (
        logicState.inputAGroup
    ) {

        logicState
            .inputAGroup
            .children[0]
            .material
            .color
            .set(
                logicState.inputA
                    ? 0x22c55e
                    : 0x475569
            );
    }


    if (
        logicState.inputBGroup
    ) {

        logicState
            .inputBGroup
            .children[0]
            .material
            .color
            .set(
                logicState.inputB
                    ? 0x22c55e
                    : 0x475569
            );
    }


    if (ledOn) {

        setStatus(
            `💡 ${type}
            gate output = 1.
            LED is ON.`
        );

    }

    else if (complete) {

        setStatus(
            `${type}
            gate output =
            ${output ? 1 : 0}.`
        );

    }

    else {

        setStatus(
            `Connect all required
            wires for the ${type} gate.`
        );
    }
};


/* =========================================================
   CHEMISTRY PROCEDURE + MCQ
========================================================= */

const __oldLoadChemistry =
    loadChemistry;


loadChemistry =
function (type) {

    __oldLoadChemistry(
        type
    );


    const names = {

        ph:
            "pH Experiment",

        filtration:
            "Filtration Experiment",

        reaction:
            "Chemical Reaction"
    };


    const procedures = {

        ph:
            "1. Place a sample bottle over the beaker. 2. Pour the sample. 3. Dip pH paper. 4. Read the pH meter.",

        filtration:
            "1. Keep the collection beaker below the funnel. 2. Move the mixture to the funnel. 3. Observe separation of solid and liquid.",

        reaction:
            "1. Choose a chemical. 2. Drag it over the reaction beaker. 3. Add different chemicals. 4. Observe color change and bubbles."
    };


    const questions = {

        ph: [

            "A solution with pH 3 is:",

            [
                "Acidic",
                "Neutral",
                "Basic"
            ],

            "Acidic"
        ],


        filtration: [

            "During filtration, the filter mainly retains:",

            [
                "Solid particles",
                "All water",
                "Gas only"
            ],

            "Solid particles"
        ],


        reaction: [

            "When chemicals are mixed and a new substance forms, this is a:",

            [
                "Chemical reaction",
                "Physical measurement",
                "Filtration"
            ],

            "Chemical reaction"
        ]
    };


    const q =
        questions[type] ||
        questions.ph;


    const block =
        document.createElement(
            "div"
        );


    block.innerHTML = `

        <hr
            style="
                border-color:
                rgba(255,255,255,.12)
            "
        >

        <div class="controlTitle">

            📋
            ${names[type] || "Chemistry"}
            Procedure

        </div>

        <div class="controlInfo">

            ${procedures[type] ||
            "Follow the displayed laboratory steps."}

        </div>

        <div
            class="controlTitle"
            style="margin-top:8px"
        >

            🧠 Quick MCQ

        </div>

        <div class="controlInfo">

            <b>
                ${q[0]}
            </b>

        </div>

        <div id="chemMC"></div>

        <div
            id="chemMCResult"
            class="controlInfo"
        ></div>
    `;


    experimentControls.appendChild(
        block
    );


    const mc =
        document.getElementById(
            "chemMC"
        );


    q[1].forEach(
        (option, index) => {

            const button =
                document.createElement(
                    "button"
                );

            button.textContent =
                String.fromCharCode(
                    65 + index
                ) +
                ". " +
                option;

            button.style.textAlign =
                "left";


            button.onclick = () => {

                const correct =
                    option === q[2];


                document.getElementById(
                    "chemMCResult"
                ).textContent =

                    correct
                        ? "✅ Correct!"
                        : "❌ Try again.";
            };


            mc.appendChild(
                button
            );
        }
    );
};


/* =========================================================
   INTERACTIVE PHOTOSYNTHESIS
========================================================= */

const __oldPhoto =
    createPhotosynthesisExperiment;


createPhotosynthesisExperiment =
function () {

    __oldPhoto();


    const panel =
        document.createElement(
            "div"
        );


    panel.innerHTML = `

        <hr
            style="
                border-color:
                rgba(255,255,255,.12)
            "
        >

        <div class="controlTitle">

            🌱 Interactive Photosynthesis

        </div>

        <div class="controlInfo">

            Watch the conditions change
            as you place water, CO₂
            and the leaf and turn
            sunlight ON.

        </div>

        <div
            id="photoChecklist"
            class="controlInfo"
        >

            💧 Water: pending<br>

            🫧 CO₂: pending<br>

            ☀ Sunlight: pending<br>

            🌿 Leaf: pending

        </div>

        <div
            class="controlTitle"
            style="margin-top:8px"
        >

            🧠 Quick MCQ

        </div>

        <div class="controlInfo">

            <b>
                Which gas is released
                during photosynthesis?
            </b>

        </div>

        <div id="photoMC"></div>

        <div
            id="photoMCResult"
            class="controlInfo"
        ></div>
    `;


    experimentControls.appendChild(
        panel
    );


    const mc =
        document.getElementById(
            "photoMC"
        );


    [
        "Oxygen (O₂)",
        "Carbon dioxide (CO₂)",
        "Nitrogen (N₂)"
    ].forEach(
        (option, index) => {

            const button =
                document.createElement(
                    "button"
                );

            button.textContent =
                String.fromCharCode(
                    65 + index
                ) +
                ". " +
                option;

            button.style.textAlign =
                "left";


            button.onclick = () => {

                document.getElementById(
                    "photoMCResult"
                ).textContent =

                    index === 0

                        ? "✅ Correct! Oxygen is released."

                        : "❌ Try again.";
            };


            mc.appendChild(
                button
            );
        }
    );


    const checklist =
        document.getElementById(
            "photoChecklist"
        );


    const state =
        window.photoState;


    if (state) {

        const timer =
            setInterval(
                () => {

                    if (
                        window.photoState !==
                        state
                    ) {

                        clearInterval(
                            timer
                        );

                        return;
                    }


                    checklist.innerHTML = `

                        💧 Water:
                        ${
                            state.water
                                ? "✅ Ready"
                                : "pending"
                        }

                        <br>

                        🫧 CO₂:
                        ${
                            state.co2
                                ? "✅ Ready"
                                : "pending"
                        }

                        <br>

                        ☀ Sunlight:
                        ${
                            state.light
                                ? "✅ ON"
                                : "pending"
                        }

                        <br>

                        🌿 Leaf:
                        ${
                            state.leaf
                                ? "✅ Ready"
                                : "pending"
                        }

                        <br><br>

                        ${
                            state.started

                                ? "🌱 <b>Photosynthesis active — O₂ bubbles are being produced.</b>"

                                : "Complete all four conditions to start."
                        }
                    `;

                },
                250
            );
    }
};

/* =========================================================
   FINAL FIX - LOGIC GATES + PLANET INFORMATION
========================================================= */

/* =========================================================
   REAL STANDARD LOGIC GATE ICON
========================================================= */

createLogicGateIcon = function(type) {

    const group = new THREE.Group();

    const shape = new THREE.Shape();


    /* AND / NAND */

    if (
        type === "AND" ||
        type === "NAND"
    ) {

        shape.moveTo(
            -0.9,
            -0.65
        );

        shape.lineTo(
            0,
            -0.65
        );

        shape.absarc(
            0,
            0,
            0.65,
            -Math.PI / 2,
            Math.PI / 2,
            false
        );

        shape.lineTo(
            -0.9,
            0.65
        );

        shape.closePath();
    }


    /* OR / NOR / XOR / XNOR */

    else if (
        type === "OR" ||
        type === "NOR" ||
        type === "XOR" ||
        type === "XNOR"
    ) {

        shape.moveTo(
            -0.9,
            -0.65
        );

        shape.quadraticCurveTo(
            -0.25,
            -0.05,
            0.9,
            0
        );

        shape.quadraticCurveTo(
            -0.25,
            0.05,
            -0.9,
            0.65
        );

        shape.quadraticCurveTo(
            -0.45,
            0,
            -0.9,
            -0.65
        );

        shape.closePath();
    }


    /* NOT */

    else {

        shape.moveTo(
            -0.9,
            -0.65
        );

        shape.lineTo(
            -0.9,
            0.65
        );

        shape.lineTo(
            0.8,
            0
        );

        shape.closePath();
    }


    const geometry =
        new THREE.ExtrudeGeometry(
            shape,
            {
                depth: 0.28,
                bevelEnabled: true,
                bevelSegments: 2,
                bevelSize: 0.035,
                bevelThickness: 0.035
            }
        );


    geometry.center();


    const mesh =
        new THREE.Mesh(
            geometry,
            mat(
                0x475569,
                {
                    roughness: 0.32,
                    metalness: 0.18
                }
            )
        );


    mesh.rotation.x =
        Math.PI / 2;


    group.add(mesh);


    const outline =
        new THREE.LineSegments(
            new THREE.EdgesGeometry(
                geometry
            ),
            new THREE.LineBasicMaterial({
                color: 0xe2e8f0
            })
        );


    outline.rotation.copy(
        mesh.rotation
    );


    group.add(outline);


    /* XOR / XNOR EXTRA CURVE */

    if (
        type === "XOR" ||
        type === "XNOR"
    ) {

        const curve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    -1.08,
                    -0.7,
                    0
                ),
                new THREE.Vector3(
                    -0.62,
                    0,
                    0
                ),
                new THREE.Vector3(
                    -1.08,
                    0.7,
                    0
                )
            ]);


        const tube =
            new THREE.Mesh(
                new THREE.TubeGeometry(
                    curve,
                    20,
                    0.035,
                    8,
                    false
                ),
                mat(0xcbd5e1)
            );


        tube.rotation.x =
            Math.PI / 2;


        tube.position.z =
            0.18;


        group.add(tube);
    }


    /* OUTPUT BUBBLE */

    if (
        type === "NAND" ||
        type === "NOR" ||
        type === "XNOR" ||
        type === "NOT"
    ) {

        const bubble =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.12,
                    18,
                    12
                ),
                mat(
                    0xf8fafc,
                    {
                        roughness: 0.2
                    }
                )
            );


        bubble.position.set(
            0.98,
            0,
            0.18
        );


        group.add(bubble);
    }


    /* GATE NAME */

    const label =
        __labTextSprite(
            type,
            "#f8fafc"
        );


    label.scale.set(
        1.5,
        0.25,
        1
    );


    label.position.set(
        0,
        -1.0,
        0.35
    );


    group.add(label);


    return group;
};


/* =========================================================
   ALL 7 LOGIC GATES
========================================================= */

const __logicGateNames = [
    "AND",
    "OR",
    "NOT",
    "NAND",
    "NOR",
    "XOR",
    "XNOR"
];


/* =========================================================
   LOGIC GATE EXPERIMENT
========================================================= */

createLogicExperiment = function() {

    const type =
        __logicGateNames.includes(
            selectedLogicGate
        )
            ? selectedLogicGate
            : "AND";


    const inputCount =
        type === "NOT"
            ? 1
            : 2;


    logicState = {

        terminals: {},

        connections: [],

        wires: [],

        selectedTerminal: null,

        inputA: false,

        inputB: false,

        ledMaterial: null,

        gateType: type,

        inputAGroup: null,

        inputBGroup: null
    };


    /* =====================================================
       GATE
    ===================================================== */

    const gate =
        new THREE.Group();


    gate.position.set(
        0,
        4.05,
        1
    );


    gate.add(
        createLogicGateIcon(
            type
        )
    );


    gate.userData.physicsPart =
        "logicGate";


    addObject(
        gate
    );


    makeDraggable(
        gate,
        `${type} Gate`
    );


    /* =====================================================
       GATE INPUT A
    ===================================================== */

    const a =
        makeTerminal(
            new THREE.Vector3(
                -1.35,
                inputCount === 1
                    ? 0
                    : 0.35,
                0.25
            ),
            "logicA",
            "Gate Input A",
            0x22c55e
        );


    gate.add(
        a
    );


    logicState.terminals.logicA =
        a;


    /* =====================================================
       GATE INPUT B
    ===================================================== */

    if (
        inputCount === 2
    ) {

        const b =
            makeTerminal(
                new THREE.Vector3(
                    -1.35,
                    -0.35,
                    0.25
                ),
                "logicB",
                "Gate Input B",
                0x22c55e
            );


        gate.add(
            b
        );


        logicState.terminals.logicB =
            b;
    }


    /* =====================================================
       GATE OUTPUT
    ===================================================== */

    const out =
        makeTerminal(
            new THREE.Vector3(
                1.35,
                0,
                0.25
            ),
            "logicOut",
            "Gate Output",
            0xf59e0b
        );


    gate.add(
        out
    );


    logicState.terminals.logicOut =
        out;


    /* =====================================================
       INPUT OBJECT
    ===================================================== */

    function createInput(
        name,
        x,
        z,
        id,
        stateKey
    ) {

        const group =
            new THREE.Group();


        const sphere =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.48,
                    24,
                    18
                ),
                mat(
                    0x475569,
                    {
                        metalness: 0.25
                    }
                )
            );


        const terminal =
            makeTerminal(
                new THREE.Vector3(
                    0.65,
                    0,
                    0
                ),
                id,
                name,
                0x22c55e
            );


        group.add(
            sphere,
            terminal
        );


        group.position.set(
            x,
            4.05,
            z
        );


        group.userData.logicInput =
            stateKey;


        addObject(
            group
        );


        makeDraggable(
            group,
            name
        );


        logicState.terminals[id] =
            terminal;


        return group;
    }


    logicState.inputAGroup =
        createInput(
            "Input A",
            -4,
            0.5,
            "inputATerm",
            "inputA"
        );


    if (
        inputCount === 2
    ) {

        logicState.inputBGroup =
            createInput(
                "Input B",
                -4,
                1.8,
                "inputBTerm",
                "inputB"
            );
    }


    /* =====================================================
       OUTPUT LED
    ===================================================== */

    const led =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.45,
                24,
                18
            ),
            new THREE.MeshStandardMaterial({
                color: 0x475569,
                emissive: 0x000000,
                emissiveIntensity: 0
            })
        );


    led.position.set(
        4,
        4.05,
        1
    );


    led.userData.logicLED =
        true;


    addObject(
        led
    );


    makeDraggable(
        led,
        "Output LED"
    );


    const ledTerminal =
        makeTerminal(
            new THREE.Vector3(
                -0.65,
                0,
                0.25
            ),
            "ledTerm",
            "LED",
            0xf59e0b
        );


    led.add(
        ledTerminal
    );


    logicState.terminals.ledTerm =
        ledTerminal;


    logicState.ledMaterial =
        led.material;


    setInfo(
        `${type} Logic Gate`,
        `Connect the inputs and output manually. Click one terminal and then click another terminal to create a wire.`
    );


    setStatus(
        `🔌 ${type} gate placed. Connect the terminals manually.`
    );


    /* =====================================================
       SIDE PANEL
    ===================================================== */

    experimentControls.innerHTML = `

        <div class="controlTitle">
            🔌 Logic Gate Practical
        </div>

        <div class="controlInfo">

            <b>Manual Connection</b><br>

            1. Select a gate.<br>

            2. Click Input A terminal and Gate A terminal.<br>

            3. For two-input gates, connect Input B also.<br>

            4. Connect Gate Output to LED.<br>

            5. Click Input A/B to turn them ON/OFF.

        </div>

        <div
            class="controlTitle"
            style="margin-top:8px;"
        >
            Gate Library
        </div>

        <div
            id="logicGateLibrary"
            style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:6px;
            "
        ></div>

        <button id="clearLogicWires">
            🧹 Remove Wires
        </button>
    `;


    const library =
        document.getElementById(
            "logicGateLibrary"
        );


    __logicGateNames.forEach(
        g => {

            const btn =
                document.createElement(
                    "button"
                );


            btn.textContent =
                (
                    g === type
                        ? "✓ "
                        : ""
                ) +
                g +
                " Gate";


            btn.style.textAlign =
                "left";


            btn.onclick = () => {

                selectedLogicGate =
                    g;


                loadPhysics(
                    "logic"
                );
            };


            library.appendChild(
                btn
            );
        }
    );


    /* =====================================================
       REMOVE WIRES
    ===================================================== */

    document.getElementById(
        "clearLogicWires"
    ).onclick = () => {

        if (!logicState)
            return;


        logicState.wires.forEach(
            wire => {

                experimentGroup.remove(
                    wire
                );
            }
        );


        logicState.wires =
            [];


        logicState.connections =
            [];


        logicState.selectedTerminal =
            null;


        updateLogic();


        setStatus(
            "🧹 Wires removed. Connect the gate again."
        );
    };


    updateLogic();
};


/* =========================================================
   LOGIC CALCULATION
========================================================= */

updateLogic = function() {

    if (!logicState)
        return;


    const type =
        logicState.gateType;


    const aConnected =
        logicState.connections.includes(
            connectionKey(
                "inputATerm",
                "logicA"
            )
        );


    const bConnected =
        type === "NOT" ||
        logicState.connections.includes(
            connectionKey(
                "inputBTerm",
                "logicB"
            )
        );


    const outputConnected =
        logicState.connections.includes(
            connectionKey(
                "logicOut",
                "ledTerm"
            )
        );


    let output =
        false;


    if (
        type === "AND"
    ) {

        output =
            logicState.inputA &&
            logicState.inputB;
    }


    if (
        type === "OR"
    ) {

        output =
            logicState.inputA ||
            logicState.inputB;
    }


    if (
        type === "XOR"
    ) {

        output =
            Boolean(
                logicState.inputA
            ) !==
            Boolean(
                logicState.inputB
            );
    }


    if (
        type === "NAND"
    ) {

        output =
            !(
                logicState.inputA &&
                logicState.inputB
            );
    }


    if (
        type === "NOR"
    ) {

        output =
            !(
                logicState.inputA ||
                logicState.inputB
            );
    }


    if (
        type === "XNOR"
    ) {

        output =
            Boolean(
                logicState.inputA
            ) ===
            Boolean(
                logicState.inputB
            );
    }


    if (
        type === "NOT"
    ) {

        output =
            !logicState.inputA;
    }


    const complete =
        aConnected &&
        bConnected &&
        outputConnected;


    const ledOn =
        complete &&
        output;


    /* LED */

    logicState
        .ledMaterial
        .emissive
        .set(
            ledOn
                ? 0xffa000
                : 0x000000
        );


    logicState
        .ledMaterial
        .emissiveIntensity =
            ledOn
                ? 2.5
                : 0;


    logicState
        .ledMaterial
        .color
        .set(
            ledOn
                ? 0xfff3b0
                : 0x475569
        );


    /* INPUT A */

    if (
        logicState.inputAGroup
    ) {

        logicState
            .inputAGroup
            .children[0]
            .material
            .color
            .set(
                logicState.inputA
                    ? 0x22c55e
                    : 0x475569
            );
    }


    /* INPUT B */

    if (
        logicState.inputBGroup
    ) {

        logicState
            .inputBGroup
            .children[0]
            .material
            .color
            .set(
                logicState.inputB
                    ? 0x22c55e
                    : 0x475569
            );
    }


    if (ledOn) {

        setStatus(
            `💡 ${type} output = 1 — LED is ON.`
        );

    }
    else if (complete) {

        setStatus(
            `${type} output = ${
                output ? 1 : 0
            }.`
        );

    }
    else {

        setStatus(
            `Connect all required wires for the ${type} gate.`
        );
    }
};


/* =========================================================
   PLANET INFORMATION CARD
========================================================= */

function showPlanetInfoCard(p) {

    infoTitle.textContent =
        `🌌 ${p.name}`;


    infoText.innerHTML = `

        <div
            style="
                display:flex;
                align-items:center;
                gap:10px;
                margin-bottom:10px;
            "
        >

            <img
                src="${p.texture}"
                alt="${p.name}"
                style="
                    width:62px;
                    height:62px;
                    border-radius:50%;
                    object-fit:cover;
                    border:2px solid rgba(255,255,255,.25);
                    box-shadow:0 0 12px rgba(255,255,255,.18);
                "
            >

            <div>

                <b
                    style="
                        font-size:16px;
                    "
                >
                    ${p.name}
                </b>

                <br>

                <span
                    style="
                        color:#94a3b8;
                    "
                >
                    ${p.type}
                </span>

            </div>

        </div>


        <div
            style="
                line-height:1.55;
            "
        >

            ${p.info}

        </div>


        <hr
            style="
                border-color:rgba(255,255,255,.12);
                margin:10px 0;
            "
        >


        <b>Mass:</b>
        ${p.mass}

        <br>

        <b>Diameter:</b>
        ${p.diameter}

        <br>

        <b>Rotation Period:</b>
        ${p.rotation}

        <br>

        <b>Orbital Period:</b>
        ${p.orbitPeriod}

        <br>

        <b>Distance from Sun:</b>
        ${p.distance}

        <br>

        <b>Gravity:</b>
        ${p.gravity}

        <br>

        <b>Temperature:</b>
        ${p.temperature}

        <br>

        <b>Moons:</b>
        ${p.moons}

        <br>

        <b>Type:</b>
        ${p.type}
    `;


    setStatus(
        `🌌 ${p.name} selected. Full information is shown in the information column.`
    );
}


/* =========================================================
   PLANET CLICK
========================================================= */

renderer.domElement.addEventListener(
    "click",
    event => {

        if (
            currentSubject !==
            "astronomy"
        ) {
            return;
        }


        if (
            currentExperiment !==
            "solar"
        ) {
            return;
        }


        if (!experimentGroup)
            return;


        updateMouse(
            event
        );


        raycaster.setFromCamera(
            mouse,
            camera
        );


        const hits =
            raycaster.intersectObjects(
                experimentGroup.children,
                true
            );


        if (
            !hits.length
        ) {
            return;
        }


        let object =
            hits[0].object;


        while (
            object &&
            object.parent !==
            experimentGroup
        ) {

            object =
                object.parent;
        }


        if (
            !object ||
            !object.userData ||
            !object.userData.planet
        ) {
            return;
        }


        const planet =
            planets.find(
                p =>
                    p.name ===
                    object.userData.planet
            );


        if (planet) {

            showPlanetInfoCard(
                planet
            );
        }
    }
);

/* =========================================================
   EXACT PLANET INFORMATION ON CLICK
========================================================= */

renderer.domElement.addEventListener(
    "click",
    event => {

        if (
            currentSubject !==
            "astronomy"
        ) {
            return;
        }

        updateMouse(event);

        raycaster.setFromCamera(
            mouse,
            camera
        );

        const hits =
            raycaster.intersectObjects(
                experimentGroup.children,
                true
            );

        if (
            !hits.length
        ) {
            return;
        }

        let object =
            hits[0].object;

        /* Find exact planet */

        while (
            object &&
            !(
                object.userData &&
                object.userData.planet
            )
        ) {

            object =
                object.parent;
        }

        if (
            !object ||
            !object.userData ||
            !object.userData.planet
        ) {
            return;
        }

        const name =
            object.userData.planet;

        if (
            name === "Sun"
        ) {
            setInfo(
                "☀️ Sun",
                "The Sun is the star at the center of our Solar System."
            );

            setStatus(
                "☀️ Sun selected."
            );

            return;
        }

        const data =
            object.userData.planetData;

        if (!data) return;

        /* =========================
           RESET OTHER PLANETS
        ========================= */

        solarBodies.forEach(
            p => {

                p.scale.set(
                    1,
                    1,
                    1
                );

            }
        );

        /* Highlight selected planet */

        object.scale.set(
            1.18,
            1.18,
            1.18
        );

        /* =========================
           INFORMATION
        ========================= */

        const details = {

            Mercury: {
                mass: "3.301 × 10²³ kg",
                diameter: "4,879 km",
                rotation: "58.6 days",
                orbit: "88 days",
                distance: "57.9 million km",
                gravity: "3.70 m/s²",
                temperature: "167°C average",
                moons: "0",
                type: "Terrestrial Planet"
            },

            Venus: {
                mass: "4.867 × 10²⁴ kg",
                diameter: "12,104 km",
                rotation: "243 days",
                orbit: "224.7 days",
                distance: "108.2 million km",
                gravity: "8.87 m/s²",
                temperature: "464°C average",
                moons: "0",
                type: "Terrestrial Planet"
            },

            Earth: {
                mass: "5.972 × 10²⁴ kg",
                diameter: "12,742 km",
                rotation: "23.93 hours",
                orbit: "365.25 days",
                distance: "149.6 million km",
                gravity: "9.81 m/s²",
                temperature: "15°C average",
                moons: "1",
                type: "Terrestrial Planet"
            },

            Mars: {
                mass: "6.417 × 10²³ kg",
                diameter: "6,779 km",
                rotation: "24.6 hours",
                orbit: "687 days",
                distance: "227.9 million km",
                gravity: "3.71 m/s²",
                temperature: "-63°C average",
                moons: "2",
                type: "Terrestrial Planet"
            },

            Jupiter: {
                mass: "1.898 × 10²⁷ kg",
                diameter: "139,820 km",
                rotation: "9.93 hours",
                orbit: "11.86 years",
                distance: "778.5 million km",
                gravity: "24.79 m/s²",
                temperature: "-110°C average",
                moons: "95+",
                type: "Gas Giant"
            },

            Saturn: {
                mass: "5.683 × 10²⁶ kg",
                diameter: "116,460 km",
                rotation: "10.7 hours",
                orbit: "29.45 years",
                distance: "1.43 billion km",
                gravity: "10.44 m/s²",
                temperature: "-140°C average",
                moons: "140+",
                type: "Gas Giant"
            },

            Uranus: {
                mass: "8.681 × 10²⁵ kg",
                diameter: "50,724 km",
                rotation: "17.2 hours",
                orbit: "84 years",
                distance: "2.87 billion km",
                gravity: "8.69 m/s²",
                temperature: "-195°C average",
                moons: "27",
                type: "Ice Giant"
            },

            Neptune: {
                mass: "1.024 × 10²⁶ kg",
                diameter: "49,244 km",
                rotation: "16.1 hours",
                orbit: "164.8 years",
                distance: "4.50 billion km",
                gravity: "11.15 m/s²",
                temperature: "-200°C average",
                moons: "14",
                type: "Ice Giant"
            }

        };

        const d =
            details[name];

        if (!d) return;

        infoTitle.textContent =
            "🌌 " + name;

        infoText.innerHTML = `

            <div style="
                text-align:center;
                margin-bottom:12px;
            ">

                <div style="
                    width:115px;
                    height:115px;
                    margin:auto;
                    border-radius:50%;
                    overflow:hidden;
                    box-shadow:
                    0 0 25px
                    rgba(125,211,252,0.5);
                ">

                    <canvas
                        id="planetInfoCanvas"
                        width="230"
                        height="230"
                        style="
                            width:100%;
                            height:100%;
                        "
                    ></canvas>

                </div>

                <h3 style="
                    margin:8px 0;
                    color:#7dd3fc;
                    font-size:20px;
                ">
                    ${name}
                </h3>

            </div>

            <b>⚖️ Mass:</b>
            ${d.mass}<br><br>

            <b>📏 Diameter:</b>
            ${d.diameter}<br><br>

            <b>🔄 Rotation:</b>
            ${d.rotation}<br><br>

            <b>☀️ Orbital Period:</b>
            ${d.orbit}<br><br>

            <b>📍 Distance from Sun:</b>
            ${d.distance}<br><br>

            <b>🪐 Gravity:</b>
            ${d.gravity}<br><br>

            <b>🌡️ Temperature:</b>
            ${d.temperature}<br><br>

            <b>🌙 Moons:</b>
            ${d.moons}<br><br>

            <b>🔬 Type:</b>
            ${d.type}<br><br>

            <b>📖 About:</b><br>
            ${data.info}

        `;

        /* Copy actual generated planet texture
           into information canvas */

        const infoCanvas =
            document.getElementById(
                "planetInfoCanvas"
            );

        if (infoCanvas) {

            const ctx =
                infoCanvas.getContext(
                    "2d"
                );

            const sourceCanvas =
                document.createElement(
                    "canvas"
                );

            sourceCanvas.width =
                512;

            sourceCanvas.height =
                256;

            const texture =
                createPlanetTexture(
                    name
                );

            const image =
                texture.image;

            if (image) {

                ctx.drawImage(
                    image,
                    0,
                    0,
                    230,
                    230
                );

            }
        }

        setStatus(
            `🌌 ${name} selected — information displayed.`
        );

    }
);