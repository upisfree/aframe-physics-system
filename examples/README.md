# Examples

To help demonstrate the features and capabilities of `aframe-physics-system`
the following collection of examples have been prepared.

Examples marked with an :x: do not currently function as expected due to open bugs.
Examples marked with an :warning: have limitations in terms of what function can be tested (e.g. due to constraints on interaction)

| Example                                                      | Cannon                                 | Cannon Worker                                          | Ammo                                     |
| ------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Demonstration of many features in a single example.          | [**Example**](cannon/sandbox.html)     | [**:x:Example**](cannon-worker/sandbox.html)           | [**Example**](ammo/sandbox.html)         |
| Construct a [compound shape](../README.md#shape) and simulate collision with a ground plane. | [**Example**](cannon/compound.html)    | [**:x:Example**](cannon-worker/compound.html)          | Not yet implemented                      |
| Demonstration of many constraints including cone twist, hinge, lock, point to point, slider (Ammo only) and distance (Cannon only) constraints. | [**Example**](cannon/constraints.html) | [**:warning:Example**](cannon-worker/constraints.html) | [**Constraints**](ammo/constraints.html) |
| Bounce simulation with [restitution (bounciness)](../README.md#system-configuration) of 1. | [**Example**](cannon/materials.html)   | [**:warning:Example**](cannon-worker/materials.html)   | Not yet implemented                      |
| Four vertical [springs](../README.md#spring) each between two boxes with an assortment of damping and stiffness values | [**Example**](cannon/springs.html)     | [**Example**](cannon-worker/springs.html)              | Not yet implemented                      |
| Apply [strong impulse](../README.md#using-the-cannonjs-api) to a cube when the user clicks with a mouse. Cubes are arranged in four 4x3 walls. | [**Example**](cannon/stress.html)      | [**:warning:Example**](cannon-worker/stress.html)      | Not yet implemented                      |
| Animate a long wall moving along the z-axis along the initial view direction. | [**Example**](cannon/sweeper.html)     | [**:x:Example**](cannon-worker/sweeper.html)           | Not yet implemented                      |
| Remove a [dynamic body](../README.md#dynamic-body-and-static-body) from the scene after 100 frames | [**Example**](cannon/ttl.html)         | [**:x:Example**](cannon-worker/ttl.html)               | Not yet implemented                      |

