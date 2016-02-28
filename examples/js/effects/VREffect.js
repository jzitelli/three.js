/**
 * @author dmarcos / https://github.com/dmarcos
 * @author mrdoob / http://mrdoob.com
 * @author jzitelli / http://github.com/jzitelli
 *
 * WebVR Spec: http://mozvr.github.io/webvr-spec/webvr.html
 *
 * Firefox: http://mozvr.com/downloads/
 * Chromium: https://drive.google.com/folderview?id=0BzudLt22BqGRbW9WTHMtOWMzNjQ&usp=sharing#list
 *
 */

THREE.VREffect = function ( renderer, onError ) {

	var vrHMD;

	var deprecatedAPI = false;

	var cameraL = new THREE.PerspectiveCamera();
	var cameraR = new THREE.PerspectiveCamera();

	cameraL.layers.enable( 1 );
	cameraR.layers.enable( 2 );

	cameraL.matrixAutoUpdate = false;
	cameraR.matrixAutoUpdate = false;

	function gotVRDevices( devices ) {

		var deviceClass = deprecatedAPI ? HMDVRDevice : VRDisplay;

		for ( var i = 0; i < devices.length; i ++ ) {

			if ( devices[ i ] instanceof deviceClass ) {

				vrHMD = devices[ i ];
				break; // We keep the first we encounter

			}

		}

		if ( vrHMD === undefined ) {

			if ( onError ) onError( 'HMD not available' );

		}

		updateSeparationMatrices();

	}

	if ( navigator.getVRDisplays ) {

		navigator.getVRDisplays().then( gotVRDevices );

	} else if ( navigator.getVRDevices ) {

		// Deprecated API.
		deprecatedAPI = true;
		navigator.getVRDevices().then( gotVRDevices );

	}

	// fullscreen

	var isPresenting = false;

	var canvas = renderer.domElement;
	var fullscreenchange = canvas.mozRequestFullScreen ? 'mozfullscreenchange' : 'webkitfullscreenchange';

	document.addEventListener( fullscreenchange, function () {

		if ( deprecatedAPI ) {

			isPresenting = document.mozFullScreenElement || document.webkitFullscreenElement;

		}

	}, false );

	window.addEventListener( 'vrdisplaypresentchange', function () {

		isPresenting = vrHMD.isPresenting;

	}, false );

	this.setFullScreen = function ( boolean ) {

		if ( vrHMD === undefined ) return;
		if ( isPresenting === boolean ) return;

		if ( !deprecatedAPI ) {

			if ( boolean ) {

				vrHMD.requestPresent( { source: canvas } );

			} else {

				vrHMD.exitPresent();

			}

		} else {

			if ( canvas.mozRequestFullScreen ) {

				canvas.mozRequestFullScreen( { vrDisplay: vrHMD } );

			} else if ( canvas.webkitRequestFullscreen ) {

				canvas.webkitRequestFullscreen( { vrDisplay: vrHMD } );

			} else {

				console.error( 'No compatible requestFullscreen method found' );

			}

		}

	};

	this.requestPresent = function () {
		this.setFullScreen( true );
	};

	this.exitPresent = function () {
		this.setFullScreen( false );
	};

	//

	var stereoTransformL = new THREE.Matrix4();
	var stereoTransformR = new THREE.Matrix4();

	function updateSeparationMatrices ( scale ) {

		scale = scale || 1;

		if ( vrHMD ) {

			var eyeParamsL = vrHMD.getEyeParameters( 'left' );
			var eyeParamsR = vrHMD.getEyeParameters( 'right' );
			var eyeTransL;
			var eyeTransR;

			if ( !deprecatedAPI ) {

				eyeTransL = eyeParamsL.offset;
				eyeTransR = eyeParamsR.offset;
				stereoTransformL.makeTranslation( scale * eyeTransL[0], scale * eyeTransL[1], scale * eyeTransL[2] );
				stereoTransformR.makeTranslation( scale * eyeTransR[0], scale * eyeTransR[1], scale * eyeTransR[2] );

			} else {

				eyeTransL = eyeParamsL.eyeTranslation;
				eyeTransR = eyeParamsR.eyeTranslation;
				stereoTransformL.makeTranslation( scale * eyeTransL.x, scale * eyeTransL.y, scale * eyeTransL.z );
				stereoTransformR.makeTranslation( scale * eyeTransR.x, scale * eyeTransR.y, scale * eyeTransR.z );

			}

		}

	}

	var _near = 0.1;
	var _far = 2000;

	function updateProjectionMatrices ( near, far ) {

		near = near || _near;
		far  = far  || _far;

		if ( vrHMD ) {

			var eyeParamsL = vrHMD.getEyeParameters( 'left'  );
			var eyeParamsR = vrHMD.getEyeParameters( 'right'  );

			var eyeFOVL;
			var eyeFOVR;

			if ( !deprecatedAPI ) {

				eyeFOVL = eyeParamsL.fieldOfView;
				eyeFOVR = eyeParamsR.fieldOfView;

			} else {

				eyeFOVL = eyeParamsL.recommendedFieldOfView;
				eyeFOVR = eyeParamsR.recommendedFieldOfView;

			}

			cameraL.projectionMatrix = fovToProjection( eyeFOVL, true, near, far );
			cameraR.projectionMatrix = fovToProjection( eyeFOVR, true, near, far );

		}

	}

	// render

	this.render = function ( scene, camera ) {

		if ( vrHMD ) {

			var autoUpdate;

			if ( scene.autoUpdate === true ) {

				scene.updateMatrixWorld();
				autoUpdate = scene.autoUpdate;
				scene.autoUpdate = false;

			}

			var size = renderer.getSize();
			var width  = size.width / 2;
			var height = size.height;

			renderer.setScissorTest( true );
			renderer.clear();

			if ( camera.parent === null ) camera.updateMatrixWorld();

			if ( _near !== camera.near || _far !== camera.far ) {

				_near = camera.near;
				_far  = camera.far;
				updateProjectionMatrices( camera.near, camera.far );

			}

			// render left eye

			renderer.setViewport( 0, 0, width, height );
			renderer.setScissor(  0, 0, width, height );
			cameraL.matrixWorld.multiplyMatrices( camera.matrixWorld, stereoTransformL );
			renderer.render( scene, cameraL );

			// render right eye

			renderer.setViewport( width, 0, width, height );
			renderer.setScissor(  width, 0, width, height );
			cameraR.matrixWorld.multiplyMatrices( camera.matrixWorld, stereoTransformR );
			renderer.render( scene, cameraR );

			renderer.setScissorTest( false );

			if ( isPresenting && !deprecatedAPI ) {

				vrHMD.submitFrame();

			}

			if ( autoUpdate === true ) {

				scene.autoUpdate = true;

			}

		} else {

			// Regular render mode if not HMD

			renderer.render( scene, camera );

		}

	};

	//

	function fovToNDCScaleOffset( fov ) {

		var pxscale = 2.0 / ( fov.leftTan + fov.rightTan );
		var pxoffset = ( fov.leftTan - fov.rightTan ) * pxscale * 0.5;
		var pyscale = 2.0 / ( fov.upTan + fov.downTan );
		var pyoffset = ( fov.upTan - fov.downTan ) * pyscale * 0.5;
		return { scale: [ pxscale, pyscale ], offset: [ pxoffset, pyoffset ] };

	}

	function fovPortToProjection( fov, rightHanded, zNear, zFar ) {

		rightHanded = rightHanded === undefined ? true : rightHanded;
		zNear = zNear === undefined ? 0.01 : zNear;
		zFar = zFar === undefined ? 10000.0 : zFar;

		var handednessScale = rightHanded ? - 1.0 : 1.0;

		// start with an identity matrix
		var mobj = new THREE.Matrix4();
		var m = mobj.elements;

		// and with scale/offset info for normalized device coords
		var scaleAndOffset = fovToNDCScaleOffset( fov );

		// X result, map clip edges to [-w,+w]
		m[ 0 * 4 + 0 ] = scaleAndOffset.scale[ 0 ];
		m[ 0 * 4 + 1 ] = 0.0;
		m[ 0 * 4 + 2 ] = scaleAndOffset.offset[ 0 ] * handednessScale;
		m[ 0 * 4 + 3 ] = 0.0;

		// Y result, map clip edges to [-w,+w]
		// Y offset is negated because this proj matrix transforms from world coords with Y=up,
		// but the NDC scaling has Y=down (thanks D3D?)
		m[ 1 * 4 + 0 ] = 0.0;
		m[ 1 * 4 + 1 ] = scaleAndOffset.scale[ 1 ];
		m[ 1 * 4 + 2 ] = - scaleAndOffset.offset[ 1 ] * handednessScale;
		m[ 1 * 4 + 3 ] = 0.0;

		// Z result (up to the app)
		m[ 2 * 4 + 0 ] = 0.0;
		m[ 2 * 4 + 1 ] = 0.0;
		m[ 2 * 4 + 2 ] = zFar / ( zNear - zFar ) * - handednessScale;
		m[ 2 * 4 + 3 ] = ( zFar * zNear ) / ( zNear - zFar );

		// W result (= Z in)
		m[ 3 * 4 + 0 ] = 0.0;
		m[ 3 * 4 + 1 ] = 0.0;
		m[ 3 * 4 + 2 ] = handednessScale;
		m[ 3 * 4 + 3 ] = 0.0;

		mobj.transpose();

		return mobj;

	}

	function fovToProjection( fov, rightHanded, zNear, zFar ) {

		var DEG2RAD = Math.PI / 180.0;

		var fovPort = {
			upTan: Math.tan( fov.upDegrees * DEG2RAD ),
			downTan: Math.tan( fov.downDegrees * DEG2RAD ),
			leftTan: Math.tan( fov.leftDegrees * DEG2RAD ),
			rightTan: Math.tan( fov.rightDegrees * DEG2RAD )
		};

		return fovPortToProjection( fovPort, rightHanded, zNear, zFar );

	}

};
