/* global THREE */
var CANNON = require('cannon-es'),
    CONSTANTS = require('./constants'),
    C_GRAV = CONSTANTS.GRAVITY,
    C_MAT = CONSTANTS.CONTACT_MATERIAL;

const { TYPE } = require('./constants');
var LocalDriver = require('./drivers/local-driver'),
    WorkerDriver = require('./drivers/worker-driver'),
    NetworkDriver = require('./drivers/network-driver'),
    AmmoDriver = require('./drivers/ammo-driver');
require('aframe-stats-panel')

/**
 * Physics system.
 */
module.exports = AFRAME.registerSystem('physics', {
  schema: {
    // CANNON.js driver type
    driver:                         { default: 'local', oneOf: ['local', 'worker', 'network', 'ammo'] },
    networkUrl:                     { default: '', if: {driver: 'network'} },
    workerFps:                      { default: 60, if: {driver: 'worker'} },
    workerInterpolate:              { default: true, if: {driver: 'worker'} },
    workerInterpBufferSize:         { default: 2, if: {driver: 'worker'} },
    workerEngine:                   { default: 'cannon', if: {driver: 'worker'}, oneOf: ['cannon'] },
    workerDebug:                    { default: false, if: {driver: 'worker'} },

    gravity:                        { default: C_GRAV },
    iterations:                     { default: CONSTANTS.ITERATIONS },
    friction:                       { default: C_MAT.friction },
    restitution:                    { default: C_MAT.restitution },
    contactEquationStiffness:       { default: C_MAT.contactEquationStiffness },
    contactEquationRelaxation:      { default: C_MAT.contactEquationRelaxation },
    frictionEquationStiffness:      { default: C_MAT.frictionEquationStiffness },
    frictionEquationRegularization: { default: C_MAT.frictionEquationRegularization },

    // Never step more than four frames at once. Effectively pauses the scene
    // when out of focus, and prevents weird "jumps" when focus returns.
    maxInterval:                    { default: 4 / 60 },

    // If true, show wireframes around physics bodies.
    debug:                          { default: false },

    // If using ammo, set the default rendering mode for debug
    debugDrawMode: { default: THREE.AmmoDebugConstants.NoDebug },
    // If using ammo, set the max number of steps per frame 
    maxSubSteps: { default: 4 },
    // If using ammo, set the framerate of the simulation
    fixedTimeStep: { default: 1 / 60 },
    // Whether to output stats, and how to output them.  One or more of "console", "events", "panel"
    stats: {type: 'array', default: []}
  },

  /**
   * Initializes the physics system.
   */
  async init() {
    var data = this.data;

    // If true, show wireframes around physics bodies.
    this.debug = data.debug;
    this.initStats();

    this.callbacks = {beforeStep: [], step: [], afterStep: []};

    this.listeners = {};
    

    this.driver = null;
    switch (data.driver) {
      case 'local':
        this.driver = new LocalDriver();
        break;

      case 'ammo':
        this.driver = new AmmoDriver();
        break;

      case 'network':
        this.driver = new NetworkDriver(data.networkUrl);
        break;

      case 'worker':
        this.driver = new WorkerDriver({
          fps: data.workerFps,
          engine: data.workerEngine,
          interpolate: data.workerInterpolate,
          interpolationBufferSize: data.workerInterpBufferSize,
          debug: data.workerDebug
        });
        break;

      default:
        throw new Error('[physics] Driver not recognized: "%s".', data.driver);
    }

    if (data.driver !== 'ammo') {
      await this.driver.init({
        quatNormalizeSkip: 0,
        quatNormalizeFast: false,
        solverIterations: data.iterations,
        gravity: data.gravity,
      });
      this.driver.addMaterial({name: 'defaultMaterial'});
      this.driver.addMaterial({name: 'staticMaterial'});
      this.driver.addContactMaterial('defaultMaterial', 'defaultMaterial', {
        friction: data.friction,
        restitution: data.restitution,
        contactEquationStiffness: data.contactEquationStiffness,
        contactEquationRelaxation: data.contactEquationRelaxation,
        frictionEquationStiffness: data.frictionEquationStiffness,
        frictionEquationRegularization: data.frictionEquationRegularization
      });
      this.driver.addContactMaterial('staticMaterial', 'defaultMaterial', {
        friction: 1.0,
        restitution: 0.0,
        contactEquationStiffness: data.contactEquationStiffness,
        contactEquationRelaxation: data.contactEquationRelaxation,
        frictionEquationStiffness: data.frictionEquationStiffness,
        frictionEquationRegularization: data.frictionEquationRegularization
      });
    } else {
      await this.driver.init({
      gravity: data.gravity,
      debugDrawMode: data.debugDrawMode,
      solverIterations: data.iterations,
      maxSubSteps: data.maxSubSteps,
      fixedTimeStep: data.fixedTimeStep
    });
    }

    this.initialized = true;

    if (this.debug) {
      this.setDebug(true);
    }
  },

  initStats() {
    // Data used for performance monitoring.
    this.statsToConsole = this.data.stats.includes("console")
    this.statsToEvents = this.data.stats.includes("events") || this.data.stats.includes("panel")
    this.statsToPanel = this.data.stats.includes("panel")

    if (this.statsToConsole || this.statsToEvents) {
      this.trackPerf = true;
      this.engine = new StatTracker(100);
      this.before = new StatTracker(100);
      this.after = new StatTracker(100);
      this.total = new StatTracker(100);
      this.tickCounter = 0;
      this.statsData = {};

      this.countBodies = {
        "ammo": () => this.countBodiesAmmo(),
        "local": () => this.countBodiesCannon(false),
        "worker": () => this.countBodiesCannon(true)
      }
    }

    if (this.statsToPanel) {
      const scene = this.el.sceneEl;
      const space = "&nbsp&nbsp&nbsp&nbsp&nbsp"
    
      scene.setAttribute("stats-panel", "")
      scene.setAttribute("stats-group__bodies", `label: Physics Bodies`)
      scene.setAttribute("stats-row__b1", `group: bodies;
                                           event:physics-tick-timer;
                                           properties: staticBodies;
                                           label: Static`)
      scene.setAttribute("stats-row__b2", `group: bodies;
                                           event:physics-tick-timer;
                                           properties: dynamicBodies;
                                           label: Dynamic`)
      scene.setAttribute("stats-row__b3", `group: bodies;
                                           event:physics-tick-timer;
                                           properties: kinematicBodies;
                                           label: Kinematic`)

      scene.setAttribute("stats-group__tick", `label: Physics Ticks: Min ${space} Max ${space} Avg`)
      scene.setAttribute("stats-row__1", `group: tick;
                                          event:physics-tick-timer;
                                          properties: before.min, before.max, before.avg;
                                          label: Before`)
      scene.setAttribute("stats-row__2", `group: tick;
                                          event:physics-tick-timer;
                                          properties: after.min, after.max, after.avg; 
                                          label: After`)
      scene.setAttribute("stats-row__3", `group: tick; 
                                          event:physics-tick-timer; 
                                          properties: engine.min, engine.max, engine.avg;
                                          label: Engine`)
      scene.setAttribute("stats-row__4", `group: tick;
                                          event:physics-tick-timer;
                                          properties: total.min, total.max, total.avg;
                                          label: Total`)
    }
  },

  /**
   * Updates the physics world on each tick of the A-Frame scene. It would be
   * entirely possible to separate the two – updating physics more or less
   * frequently than the scene – if greater precision or performance were
   * necessary.
   * @param  {number} t
   * @param  {number} dt
   */
  tick: function (t, dt) {
    if (!this.initialized || !dt) return;

    const beforeStartTime = performance.now();

    var i;
    var callbacks = this.callbacks;

    for (i = 0; i < this.callbacks.beforeStep.length; i++) {
      this.callbacks.beforeStep[i].beforeStep(t, dt);
    }

    const engineStartTime = performance.now();

    this.driver.step(Math.min(dt / 1000, this.data.maxInterval));

    const engineEndTime = performance.now();

    for (i = 0; i < callbacks.step.length; i++) {
      callbacks.step[i].step(t, dt);
    }

    for (i = 0; i < callbacks.afterStep.length; i++) {
      callbacks.afterStep[i].afterStep(t, dt);
    }

    if (this.trackPerf) {
      const afterEndTime = performance.now();

      this.before.record(engineStartTime - beforeStartTime)
      this.engine.record(engineEndTime - engineStartTime)
      this.after.record(afterEndTime - engineEndTime)
      this.total.record(afterEndTime - beforeStartTime)

      this.tickCounter++;

      if (this.tickCounter === 100) {

        this.countBodies[this.data.driver]()
        this.statsData.engine = this.engine.report;
        this.statsData.before = this.before.report;
        this.statsData.after = this.after.report;
        this.statsData.total = this.total.report;

        if (this.statsToConsole) {
          console.log("Physics tick stats:", this.statsData)
        }

        if (this.statsToEvents) {
          this.el.emit("physics-tick-timer", this.statsData)
        }

        this.before.reset()
        this.engine.reset()
        this.after.reset()
        this.total.reset()
        this.tickCounter = 0;
      }
    }
  },

  countBodiesAmmo() {

    const statsData = this.statsData
    statsData.staticBodies = 0
    statsData.kinematicBodies = 0
    statsData.dynamicBodies = 0

    function type(el) {
      return el.components['ammo-body'].data.type
    }

    this.driver.els.forEach((el) => {

      switch(type(el)) {
        case TYPE.STATIC:
          statsData.staticBodies++ 
          break;

        case TYPE.DYNAMIC:
          statsData.dynamicBodies++ 
          break;

        case TYPE.KINEMATIC:
          statsData.kinematicBodies++ 
          break;
        
        default:
          console.error("Unexpected body type:", type(el))
          break;
      }
    })
  },

  countBodiesCannon(worker) {

    const statsData = this.statsData
    statsData.staticBodies = 0
    statsData.kinematicBodies = 0
    statsData.dynamicBodies = 0

    const bodies = worker ? Object.values(this.driver.bodies) : this.driver.world.bodies

    bodies.forEach((body) => {

      switch(body.type) {
        case CANNON.Body.STATIC:
          statsData.staticBodies++ 
          break;

        case CANNON.Body.DYNAMIC:
          statsData.dynamicBodies++ 
          break;

        default:
          console.error("Unexpected body type:", body.type)
          break;
      }
    })
  },

  setDebug: function(debug) {
    this.debug = debug;
    if (this.data.driver === 'ammo' && this.initialized) {
      if (debug && !this.debugDrawer) {
        this.debugDrawer = this.driver.getDebugDrawer(this.el.object3D);
        this.debugDrawer.enable();
      } else if (this.debugDrawer) {
        this.debugDrawer.disable();
        this.debugDrawer = null;
      }
    }
  },

  /**
   * Adds a body to the scene, and binds proxied methods to the driver.
   * @param {CANNON.Body} body
   */
  addBody: function (body, group, mask) {
    var driver = this.driver;

    if (this.data.driver === 'local') {
      body.__applyImpulse = body.applyImpulse;
      body.applyImpulse = function () {
        driver.applyBodyMethod(body, 'applyImpulse', arguments);
      };

      body.__applyForce = body.applyForce;
      body.applyForce = function () {
        driver.applyBodyMethod(body, 'applyForce', arguments);
      };

      body.updateProperties = function () {
        driver.updateBodyProperties(body);
      };

      this.listeners[body.id] = function (e) { body.el.emit('collide', e); };
      body.addEventListener('collide', this.listeners[body.id]);
    }

    this.driver.addBody(body, group, mask);
  },

  /**
   * Removes a body and its proxied methods.
   * @param {CANNON.Body} body
   */
  removeBody: function (body) {
    this.driver.removeBody(body);

    if (this.data.driver === 'local' || this.data.driver === 'worker') {
      body.removeEventListener('collide', this.listeners[body.id]);
      delete this.listeners[body.id];

      body.applyImpulse = body.__applyImpulse;
      delete body.__applyImpulse;

      body.applyForce = body.__applyForce;
      delete body.__applyForce;

      delete body.updateProperties;
    }
  },

  /** @param {CANNON.Constraint or Ammo.btTypedConstraint} constraint */
  addConstraint: function (constraint) {
    this.driver.addConstraint(constraint);
  },

  /** @param {CANNON.Constraint or Ammo.btTypedConstraint} constraint */
  removeConstraint: function (constraint) {
    this.driver.removeConstraint(constraint);
  },

  /**
   * Adds a component instance to the system and schedules its update methods to be called
   * the given phase.
   * @param {Component} component
   * @param {string} phase
   */
  addComponent: function (component) {
    var callbacks = this.callbacks;
    if (component.beforeStep) callbacks.beforeStep.push(component);
    if (component.step)       callbacks.step.push(component);
    if (component.afterStep)  callbacks.afterStep.push(component);
  },

  /**
   * Removes a component instance from the system.
   * @param {Component} component
   * @param {string} phase
   */
  removeComponent: function (component) {
    var callbacks = this.callbacks;
    if (component.beforeStep) {
      callbacks.beforeStep.splice(callbacks.beforeStep.indexOf(component), 1);
    }
    if (component.step) {
      callbacks.step.splice(callbacks.step.indexOf(component), 1);
    }
    if (component.afterStep) {
      callbacks.afterStep.splice(callbacks.afterStep.indexOf(component), 1);
    }
  },

  /** @return {Array<object>} */
  getContacts: function () {
    return this.driver.getContacts();
  },

  getMaterial: function (name) {
    return this.driver.getMaterial(name);
  }
});

class StatTracker {
  constructor(cycles = 100, dps = 2) {
    this.cycles = cycles
    this.dps = dps
    this.reset()
  }

  reset() {
    this.max = 0
    this.min = Infinity
    this.cumulative = 0
    this.counter = 0
  }

  record(value) {
    this.cumulative += value
    if (value > this.max) {
      this.max = value
    }
    if (value < this.min) {
      this.min = value
    }
    this.counter++
  }

  get avg() {
    // Average will only be valid if we have recorded the correct number of cycles.
    console.assert(this.counter === this.cycles)
    return this.cumulative / this.cycles
  }

  get report() {
    return { avg: this.avg.toFixed(this.dps),
             max: this.max.toFixed(this.dps),
             min: this.min.toFixed(this.dps) }
  }
}