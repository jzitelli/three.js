/**
 * @author dmarcos / https://github.com/dmarcos
 * @author mrdoob / http://mrdoob.com
 */

THREE.VRControls = function ( object, onError ) {

	var scope = this;

	var vrInputs = [];

	var deprecatedAPI = false;

	function gotVRDevices( devices ) {

		var deviceClass = deprecatedAPI ? PositionSensorVRDevice : VRDisplay;

		for ( var i = 0; i < devices.length; i ++ ) {

			if ( devices[ i ] instanceof deviceClass ) {

				vrInputs.push( devices[ i ] );

			}

		}

		if ( vrInputs.length === 0 ) {

			if ( onError ) onError( 'VR inputs not available' );

		}

	}

	if ( navigator.getVRDisplays ) {

		navigator.getVRDisplays().then( gotVRDevices );

	} else if ( navigator.getVRDevices ) {

		// Deprecated API.
		deprecatedAPI = true;
		navigator.getVRDevices().then( gotVRDevices );

	}

	// the Rift SDK returns the position in meters
	// this scale factor allows the user to define how meters
	// are converted to scene units.

	this.scale = 1;

	this.update = function () {

		for ( var i = 0; i < vrInputs.length; i ++ ) {

			var vrInput = vrInputs[ i ];

			if ( vrInput.getPose ) {

				var pose = vrInput.getPose();

				if ( pose.orientation !== null ) {

					object.quaternion.fromArray( pose.orientation );

				}

				if ( pose.position !== null ) {

					object.position.fromArray( pose.position ).multiplyScalar( scope.scale );

				}

			} else {

				// Deprecated API.
				var state = vrInput.getState();

				if ( state.orientation !== null ) {

					object.quaternion.copy( state.orientation );

				}

				if ( state.position !== null ) {

					object.position.copy( state.position ).multiplyScalar( scope.scale );

				}

			}

		}

	};

	this.resetSensor = function () {

		for ( var i = 0; i < vrInputs.length; i ++ ) {

			var vrInput = vrInputs[ i ];

			if ( vrInput.resetPose !== undefined ) {

				vrInput.resetPose();

			} else if ( vrInput.resetSensor !== undefined ) {

				// Deprecated API.
				vrInput.resetSensor();

			}

		}

	};

	this.dispose = function () {

		vrInputs = [];

	};

};
