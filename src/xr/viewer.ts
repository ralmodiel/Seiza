import * as THREE from "three";

/**
 * Where the viewer's eyes are in the world, for anything that works from
 * the viewer's position: rain around them, the sky dome, sounds by
 * distance, avatars and videos by range.
 *
 * `camera.position` is that only on a flat screen. In a headset, R3F's
 * camera is the XR camera, a child of the XR origin, which PlayerRig moves
 * as the player walks; its position is just the head's offset within the
 * playspace, so everything keyed to it happened around the world's origin
 * (rain fell in a box over the classroom). The world matrix holds the real
 * place: it's the one the last frame rendered from, a frame behind, which
 * nothing here can tell.
 */
export function viewerPosition(camera: THREE.Camera, out: THREE.Vector3): THREE.Vector3 {
  return camera.parent ? out.setFromMatrixPosition(camera.matrixWorld) : out.copy(camera.position);
}
