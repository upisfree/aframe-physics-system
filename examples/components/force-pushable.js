/**
 * Force Pushable component.
 *
 * Applies behavior to the current entity such that cursor clicks will apply a
 * strong impulse, pushing the entity away from the viewer.
 *
 * Requires: physics
 */
AFRAME.registerComponent('force-pushable', {
  schema: {
    force: { default: 10 }
  },
  init: function () {

    if (this.el.sceneEl.getAttribute('physics').driver === "ammo") {
      this.driver = "ammo"
    }
    else {
      this.driver = "cannon"
    }

    this.pStart = new THREE.Vector3();
    this.sourceEl = this.el.sceneEl.querySelector('[camera]');

    if (this.driver === "cannon") {
      this.el.addEventListener('click', this.forcePushCannon.bind(this));
    }
    else {
      this.el.addEventListener('click', this.forcePushAmmo.bind(this));

      this.force = new THREE.Vector3();

      this.el.addEventListener("body-loaded", e => {
        this.impulseBtVector = new Ammo.btVector3();
      });
    }
  },

  forcePushCannon: function () {
    var force,
        el = this.el,
        pStart = this.pStart.copy(this.sourceEl.getAttribute('position'));

    // Compute direction of force, normalize, then scale.
    force = el.body.position.vsub(pStart);
    force.normalize();
    force.scale(this.data.force, force);

    el.body.applyImpulse(force, el.body.position);
  },

  forcePushAmmo: function () {

    if (!this.impulseBtVector) return;

    const el = this.el
    const force = this.force
    force.copy(el.object3D.position)
    force.normalize();
    force.multiplyScalar(this.data.force);

    // would like to use e..body.applyImpulse(), but haven't got it to work how I
    // expected yet.  Setting Linear Velocity at least gives us a reasonable level of interaction
    // for now...
    el.body.setLinearVelocity(this.impulseBtVector);
  }
});
