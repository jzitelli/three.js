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
    var eyeTranslationL, eyeFOVL;
    var eyeTranslationR, eyeFOVR;

    var stereoTransformL = new THREE.Matrix4(),
        stereoTransformR = new THREE.Matrix4();

    var scale = 1;
    Object.defineProperty( this, 'scale', {

        get: function () {

            return scale;

        },

        set: function ( s ) {

            scale = s;
            stereoTransformL.makeTranslation( scale * eyeTranslationL.x, scale * eyeTranslationL.y, scale * eyeTranslationL.z );
            stereoTransformR.makeTranslation( scale * eyeTranslationR.x, scale * eyeTranslationR.y, scale * eyeTranslationR.z );

        }

    } );

    var cameraL = new THREE.PerspectiveCamera();
    cameraL.layers.enable( 1 );

    var cameraR = new THREE.PerspectiveCamera();
    cameraR.layers.enable( 2 );

    cameraL.matrixAutoUpdate = false;
    cameraR.matrixAutoUpdate = false;

    var updateProjectionMatrices = function ( near, far ) {

        if ( vrHMD ) {

            var eyeParamsL = vrHMD.getEyeParameters( 'left' );
            var eyeParamsR = vrHMD.getEyeParameters( 'right' );

            eyeTranslationL = eyeParamsL.eyeTranslation;
            eyeTranslationR = eyeParamsR.eyeTranslation;
            eyeFOVL = eyeParamsL.recommendedFieldOfView;
            eyeFOVR = eyeParamsR.recommendedFieldOfView;

            cameraL.projectionMatrix = fovToProjection( eyeFOVL, true, near, far );
            cameraR.projectionMatrix = fovToProjection( eyeFOVR, true, near, far );

            this.scale = 1;

        }

    }.bind(this);

    function gotVRDevices( devices ) {

        for ( var i = 0; i < devices.length; i ++ ) {

            if ( devices[ i ] instanceof HMDVRDevice ) {

                vrHMD = devices[ i ];

                break; // We keep the first we encounter

            }

        }

        if ( vrHMD === undefined ) {

            if ( onError ) onError( 'HMD not available' );

        }

    }

    if ( navigator.getVRDevices ) {

        navigator.getVRDevices().then( gotVRDevices );

    }

    //

    this.setSize = function( width, height ) {

        renderer.setSize( width, height );

    };

    // fullscreen

    var isFullscreen = false;

    var canvas = renderer.domElement;
    var fullscreenchange = canvas.mozRequestFullScreen ? 'mozfullscreenchange' : 'webkitfullscreenchange';

    document.addEventListener( fullscreenchange, function ( event ) {

        isFullscreen = document.mozFullScreenElement || document.webkitFullscreenElement;

    }, false );

    this.setFullScreen = function ( boolean ) {

        if ( vrHMD === undefined ) return;
        if ( isFullscreen === boolean ) return;

        if ( canvas.mozRequestFullScreen ) {

            canvas.mozRequestFullScreen( { vrDisplay: vrHMD } );

        } else if ( canvas.webkitRequestFullscreen ) {

            canvas.webkitRequestFullscreen( { vrDisplay: vrHMD } );

        }

    };

    // render

    var near,
        far;

    this.render = function ( scene, camera ) {

        if ( Array.isArray( scene ) ) {

	    console.warn( 'THREE.VREffect.render() no longer supports arrays. Use object.layers instead.' );
	    scene = scene[ 0 ];

	}

        if ( vrHMD ) {

            var autoUpdate;

            if ( scene.autoUpdate === true ) {

                scene.updateMatrixWorld();
                autoUpdate = scene.autoUpdate;
                scene.autoUpdate = false;

            }

            var size = renderer.getSize();

            renderer.setScissorTest( true );
            renderer.clear();

            if ( camera.parent === null ) camera.updateMatrixWorld();

            if ( ( near !== camera.near ) || ( far !== camera.far ) ) {

                near = camera.near;
                far = camera.far;
                updateProjectionMatrices( near, far );

            }
            
            // render left eye
            renderer.setViewport( 0, 0, size.width / 2, size.height );
            renderer.setScissor( 0, 0, size.width / 2, size.height );
            cameraL.matrixWorld.multiplyMatrices( camera.matrixWorld, stereoTransformL );
            renderer.render( scene, cameraL );

            // render right eye
            renderer.setViewport( size.width / 2, 0, size.width / 2, size.height );
            renderer.setScissor( size.width / 2, 0, size.width / 2, size.height );
            cameraR.matrixWorld.multiplyMatrices( camera.matrixWorld, stereoTransformR );
            renderer.render( scene, cameraR );

            renderer.setScissorTest( false );

            if ( autoUpdate === true ) {

                scene.autoUpdate = true;

            }

            return;

        }

        // Regular render mode if not HMD

        renderer.render( scene, camera );

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
