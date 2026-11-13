/**
 * Recisor Demonstration Script
 * Demonstrates initialization patterns, layout generation, and event listening.
 */

document.addEventListener( 'DOMContentLoaded', () => {

	// -------------------------------------------------------------
	// 1. Sibling Workspace (Option A)
	// Automatically splits sibling panels and injects handles between them
	// -------------------------------------------------------------
	const siblingContainer = document.getElementById( 'workspace-sibling' );
  Recisor.createSiblingWorkspace( siblingContainer );

	attachTelemetryListeners( siblingContainer, 'Sibling Grid' );

	// -------------------------------------------------------------
	// 2. Docked Left Sidebar (Option B)
	// Injects a right-edge handle inside the target panel
	// -------------------------------------------------------------
	const leftSidebarTarget = document.getElementById( 'sidebar-left-target' );
	Recisor.createParentChildWorkspace( leftSidebarTarget, {
		side:           'right',
		usePercentages: true
	} );

	attachTelemetryListeners( leftSidebarTarget.parentElement, 'Left Sidebar' );

	// -------------------------------------------------------------
	// 3. Dual-Docked Workbench (Option C)
	// Left panel resizes from right edge; Right panel resizes from left edge
	// -------------------------------------------------------------
	const dualLeft  = document.getElementById( 'dual-left-sidebar' );
	const dualRight = document.getElementById( 'dual-right-sidebar' );

	Recisor.createParentChildWorkspace( dualLeft, {
		side:           'right',
		usePercentages: true
	} );

	Recisor.createParentChildWorkspace( dualRight, {
		side:           'left',
		usePercentages: true
	} );

	attachTelemetryListeners( document.getElementById( 'workspace-dual' ), 'Dual Workbench' );

	// -------------------------------------------------------------
	// 4. Manual Behavioral Binding
	// Wires up an explicit handle element without touching DOM structure
	// -------------------------------------------------------------
  /*
	const customHandle = document.getElementById( 'custom-dragbar-handle' );
	const customTarget = document.getElementById( 'custom-target-panel' );

	Recisor.bind( customHandle, customTarget, { side: 'right' } );

	attachTelemetryListeners( customTarget.parentElement, 'Manual Bind' );
  */
} );

// -------------------------------------------------------------
// Live Event Telemetry Helper
// -------------------------------------------------------------
const eventLog = document.getElementById( 'event-log' );

function attachTelemetryListeners( containerElement, sourceName ) {
	if( !containerElement ) return;

	containerElement.addEventListener( 'recisor:dragstart', ( e ) => {
		logEvent( `${sourceName} -> [dragstart] Started resizing.` );
	} );

	containerElement.addEventListener( 'recisor:resize', ( e ) => {
		const width = Math.round( e.detail.leftWidth );
		logEvent( `${sourceName} -> [resize] Current Width: ${width}px` );
	} );

	containerElement.addEventListener( 'recisor:dragend', ( e ) => {
		logEvent( `${sourceName} -> [dragend] Drag complete.` );
	} );
}

function logEvent( message ) {
	if( eventLog ) {
		eventLog.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
	}
}

function clearTelemetry() {
	if( eventLog ) {
		eventLog.textContent = 'Idle — Interact with any dragbar above to monitor event dispatches.';
	}
}