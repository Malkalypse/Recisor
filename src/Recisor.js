/** Recisor: Efficient, generic layout orchestrator for managing drag bars and resizable panels
 * - Supports both multi-sibling structures and parent/child internal dragbars
 */
class Recisor {

	// #region Initialization
	/** Constructor
	 * @param {HTMLElement}	container									- Wrapper element containing panels and drag bars
	 * @param {Object}			options										- Global configuration overrides
	 * @param {number}			[options.minSize]					- Minimum width/height for panels (default: 100px)
	 * @param {number}			[options.maxSize]					- Maximum width/height for panels (default: Infinity)
	 * @param {boolean}			[options.usePercentages]	- Whether sizing calculations produce % or px (default: false)
	 * @param {string}			[options.handleClass]			- Optional custom CSS class name to apply to generated handles
	 * @param {string}			[options.id]							- Optional ID attribute for generated handle
	 */
	constructor( container, options = {} ) {

		// Validate and store container
		if( !container ) throw new Error( "Recisor requires a valid container element." );
		this.container = container;

		// Validate and store options
		this.options = {
			minSize:        options.minSize ?? 100,
			maxSize:        options.maxSize ?? Infinity,
			usePercentages: options.usePercentages ?? false,
			handleClass:    options.handleClass ?? '',
			id:             options.id ?? null,
			...options
		};

		// Set internal state variables
		this.activeDrag     = null;
		this.isTicking      = false;
		this.handles        = [];
		this.resizeObserver = null;

		// Set event handlers
		this._onMouseDown = this._onMouseDown.bind( this );
		this._onMouseMove = this._onMouseMove.bind( this );
		this._onMouseUp   = this._onMouseUp.bind( this );

		// Setup DOM listeners and register existing handles
		this.container.addEventListener( 'mousedown', this._onMouseDown );
		this._catalogExistingHandles();
	}

	/** Helper: Registers and styles any handles already present in container markup */
	_catalogExistingHandles() {

		// Catalog pre-existing drag bars in container markup
		const existing = Array.from( this.container.querySelectorAll( '[data-recisor-handle]' ) );
		existing.forEach( handle => {

			// Apply custom handle class if provided
			if( this.options.handleClass ) {
				handle.classList.add( this.options.handleClass ); // add to handle list for instance
			}
			this.handles.push( handle );
		} );
	}
	// #endregion Initialization

	// #region Structural Generation

	/** Factory: Injects drag bars between every sequential sibling in container node
	 * @param {HTMLElement}	container							- Element containing panels and drag bars
	 * @param {Object}			options								- Global configuration overrides
	 * @param {string}			[options.handleClass]	- Optional custom CSS class for generated handles
	 * @param {string}			[options.id]					- Optional ID attribute for generated handle
	 * @returns {Recisor} Recisor instance
	 */
	static createSiblingWorkspace( container, options = {} ) {
		if( !container ) throw new Error( "Container element required." );
		container.classList.add( 'recisor-container' );

		const panels = Array.from( container.children ).filter(
			el => !el.hasAttribute( 'data-recisor-handle' )
		);

		panels.forEach( panel => panel.classList.add( 'recisor-panel' ) );

		const instance = new Recisor( container, { usePercentages: true, ...options } );

		// Inject drag bars first so they occupy physical layout space
		for( let i = panels.length - 1; i > 0; i-- ) {
			const dragbar = Recisor._createHandleElement( {
				mode:        'sibling',
				baseClass:   'recisor-sibling-handle',
				handleClass: instance.options.handleClass,
				id:          instance.options.id
			} );

			container.insertBefore( dragbar, panels[i] );
			instance.handles.push( dragbar );
		}

		// Distribute space among panels
		instance._distributeSiblingSpace( panels, container.clientWidth );

		// Keep panel proportions aligned during window / container resizing
		instance._setupResizeObserver( panels );

		return instance;
	}
	/** Helper: Observes container size changes to prevent fixed-handle pixel skew */
	_setupResizeObserver( panels ) {
		let lastWidth = this.container.clientWidth; // store last container width

		// Observe container size changes
		const observer = new ResizeObserver( entries => {
			for( const entry of entries ) {
				const currentWidth = entry.contentRect.width;

				// Only recalculate if container width changed and not currently dragging
				if( currentWidth > 0 && Math.round( currentWidth ) !== Math.round( lastWidth ) && !this.activeDrag ) {
					lastWidth = currentWidth;
					this._distributeSiblingSpace( panels, currentWidth );
				}
			}
		} );

		observer.observe( this.container );
		this.resizeObserver = observer;
	}

	/** Helper: Calculates and assigns proportional percentage widths (deducting handle widths) */
	_distributeSiblingSpace( panels, containerWidth ) {
		if( containerWidth <= 0 || panels.length === 0 ) return;

		// Determine exact width available for panel bodies
		const totalHandleWidth		= this.handles.reduce( ( sum, h ) => sum + h.offsetWidth, 0 );
		const availablePanelWidth	= containerWidth - totalHandleWidth;

		if( availablePanelWidth <= 0 ) return;

		// Calculate total current pixel width of all panels
		const totalRenderedWidth = panels.reduce( ( sum, p ) => sum + p.offsetWidth, 0 );

		panels.forEach( panel => {

			// Proportional slice of available space (avoiding double-deduction)
			const share = totalRenderedWidth > 0 
				? ( panel.offsetWidth / totalRenderedWidth ) 
				: ( 1 / panels.length );

			const panelPx = share * availablePanelWidth;		// convert to pixels
			const pct = ( panelPx / containerWidth ) * 100;	// convert to percentage

			panel.style.flex			= 'none';
			panel.style.width			= `${pct}%`;
			panel.style.flexBasis	= `${pct}%`;
		} );
	}

	/** Factory: Injects internal drag bar into panel's left or right edge */
	static createParentChildWorkspace( panel, options = {} ) {
		if( !panel ) throw new Error( "Panel element required." );
		
		// Identify container and panel
		if( panel.parentElement ) {
			panel.parentElement.classList.add( 'recisor-container' );
		}
		panel.classList.add( 'recisor-panel' );

		return Recisor.injectHandle( panel, options );
	}

	/** Factory: Injects drag bar directly into self-contained panel
	 * - Does not modify parent classes or apply absolute layout wrappers
	 */
	static injectHandle( panel, options = {} ) {
		if( !panel ) throw new Error( "Panel element required." ); // validate panel

		// Get side
		const side = options.side === 'left'
			? 'left'
			: 'right';

		if( side === 'left' ) {							// for right-docked sidebar (handle on the left)
			panel.style.marginLeft = 'auto';	// ensure it anchors to right edge of parent
		}

		// Get default base class
		const defaultBaseClass = side === 'left'
			? 'recisor-left-handle'
			: 'recisor-right-handle';

		// Get base class
		const baseClass = options.baseClass !== undefined
			? options.baseClass
			: defaultBaseClass;

		// Create Recisor instance
		const instance = new Recisor( panel, { usePercentages: false, ...options } );

		// Create drag bar
		const dragbar = Recisor._createHandleElement( {
			mode:        'parent',
			side:        side,
			baseClass:   baseClass,
			handleClass: instance.options.handleClass,
			id:          instance.options.id
		} );

		// Place at start or end of panel
		if( side === 'left' && panel.firstChild ) {
			panel.insertBefore( dragbar, panel.firstChild );
		} else {
			panel.appendChild( dragbar );
		}

		instance.handles.push( dragbar ); // store handle
		return instance;
	}

	/** Create and configure a drag handle element with metadata and classes
	 * @param {string} mode						- Drag bar mode ('parent' or 'sibling')
	 * @param {string} [side]					- Drag bar side ('left' or 'right')
	 * @param {string} [baseClass]		- Base CSS class for drag bar
	 * @param {string} [handleClass]	- CSS class for drag bar
	 * @param {string} [id]						- ID attribute for drag bar
	*/
	static _createHandleElement( {
		mode,
		side				= null,
		baseClass		= '',
		handleClass	= '',
		id					= null
	} ) {
		const dragbar = document.createElement( 'div' );					// create dragbar element
		Recisor._applyHandleMetadata( dragbar, { mode, side } );	// stamp handle metadata

		// Resolve ID (explicit ID, or fallback to handleClass)
		if( id ) {
			dragbar.id = id;
		} else if( handleClass && !document.getElementById( handleClass ) ) {
			dragbar.id = handleClass;
		}

		// Compose CSS classes (filtering out empty values)
		const classes = [];
		if( baseClass )		classes.push( baseClass );
		if( handleClass )	classes.push( handleClass );

		// Apply classes
		if( classes.length > 0 ) {
			dragbar.className = classes.join( ' ' );
		}

		return dragbar;
	}

	/** Bind resize behavior between an existing handle and a target panel */
	static bind( handle, targetPanel, options = {} ) {
		const side = options.side || 'left';
		Recisor._applyHandleMetadata( handle, { mode: 'parent', side } );
		return new Recisor( targetPanel, { usePercentages: false, ...options } );
	}

	/** Applies dataset attributes to handle elements */
	static _applyHandleMetadata( handle, { mode = 'parent', side = null } ) {
		handle.setAttribute( 'data-recisor-handle', '' );
		handle.setAttribute( 'data-recisor-mode', mode );

		// Apply side if provided
		if( side ) {
			handle.setAttribute( 'data-recisor-side', side );
		}
	}
	// #endregion Structural Generation

	// #region Event Orchestration

	// #region Mouse Down
	_onMouseDown( e ) {
		const dragBar = e.target.closest( '[data-recisor-handle]' ); // identify clicked handle
		if( !dragBar ) return;

		e.preventDefault();

		// Resolve dragbar metadata
		const mode = dragBar.dataset.recisorMode || 'sibling';
		const side = dragBar.dataset.recisorSide || 'right';

		// Resolve target panels
		const { leftPanel, rightPanel } = this._resolveTargetPanels( dragBar, mode );
		if( !leftPanel ) return;

		// Create drag state
		this.activeDrag = this._createDragState( e, {
			dragBar, mode, side, leftPanel, rightPanel
		} );

		// Apply visual active states
		dragBar.classList.add( 'recisor-dragging' );
		this.container.classList.add( 'recisor-container-dragging' );

		// Attach global mouse tracking
		window.addEventListener( 'mousemove', this._onMouseMove, { passive: false } );
		window.addEventListener( 'mouseup', this._onMouseUp );
		
		this._emit( 'dragstart', this.activeDrag ); // dispatch dragstart event
	}

	/** Identify which panels are controlled by the active dragbar */
	_resolveTargetPanels( dragBar, mode ) {
		if( mode === 'parent' ) { // parent mode
			return {
				leftPanel:	dragBar.closest( '.recisor-panel' ) || dragBar.parentElement,
				rightPanel:	null
			};
		}

		return { // sibling mode
			leftPanel:	this._resolvePanel( dragBar, 'left' ),
			rightPanel:	this._resolvePanel( dragBar, 'right' )
		};
	}

	/** Resolve a panel element from a dragbar */
	_resolvePanel( bar, position ) {
		const attrId = bar.getAttribute( `data-recisor-${position}` );
		if( attrId ) return document.getElementById( attrId );

		// Return panel position relative to dragbar
		return position === 'left'
			? bar.previousElementSibling
			: bar.nextElementSibling;
	}

	/** Build initial measurement and boundary snapshot for drag session */
	_createDragState( e, { dragBar, mode, side, leftPanel, rightPanel } ) {
		const parentContainer = leftPanel.parentElement || document.body;
		const containerWidth  = parentContainer.clientWidth || window.innerWidth;
		const dynamicMax      = this._calculateDynamicMax( leftPanel, mode, containerWidth );

		// Read dataset min/max
		const readMin = ( panel ) => Number( panel?.dataset.recisorMin ) || this.options.minSize;
		const readMax = ( panel ) => Number( panel?.dataset.recisorMax );

		return {
			mode,
			side,
			dragBar,
			leftPanel,
			rightPanel,
			startX:          e.clientX,
			startLeftWidth:  leftPanel.offsetWidth,
			startRightWidth: rightPanel ? rightPanel.offsetWidth : 0,
			containerWidth,
			minLeft:         readMin( leftPanel ),
			maxLeft:         readMax( leftPanel ) || dynamicMax,
			minRight:        rightPanel ? readMin( rightPanel ) : 0,
			maxRight:        rightPanel ? ( readMax( rightPanel ) || this.options.maxSize ) : Infinity
		};
	}

	/** Calculate maximum allowable expansion for panel based on its surrounding elements */
	_calculateDynamicMax( panel, mode, containerWidth ) {
		let maxLimit = this.options.maxSize;
		if( mode !== 'parent' ) return maxLimit;

		const parent = panel.parentElement; // get parent element

		// If panel is within a recisor container
		if( parent && parent.classList.contains( 'recisor-container' ) ) {

			// Collect sibling panels
			const siblings = Array.from( parent.children ).filter(
				el => el !== panel && !el.hasAttribute( 'data-recisor-handle' )
			);

			let reservedSpace = 0;

			siblings.forEach( sib => {
				const style    = window.getComputedStyle( sib );		// get computed style
				const flexGrow = parseFloat( style.flexGrow ) || 0;	// get flex-grow value

				// Determine reserved space
				if( flexGrow > 0 ) {
					const minW = parseFloat( style.minWidth );
					reservedSpace += ( !isNaN( minW ) && minW > 0 ) ? minW : 0;
				} else {
					reservedSpace += sib.offsetWidth;
				}
			} );
			
			const available = containerWidth - reservedSpace; // calculate available space

			// Return maximum allowed expansion
			return Math.max( this.options.minSize, Math.min( maxLimit, available ) );
		}

		// Otherwise, limit to container width
		return Math.min( maxLimit, containerWidth - 10 );
	}
	// #endregion Mouse Down

	// #region Mouse Move
	_onMouseMove( e ) {
		if( !this.activeDrag ) return;

		// Throttle resizing
		if( !this.isTicking ) {
			window.requestAnimationFrame( () => {
				this._executeResize( e );
				this.isTicking = false;
			} );
			this.isTicking = true;
		}
	}

	/** Orchestrates active resize calculation and apply styles */
	_executeResize( e ) {
		if( !this.activeDrag ) return;

		const state  = this.activeDrag;
		const deltaX = this._calculateDeltaX( e.clientX, state ); // compute pixel delta

		if( state.mode === 'parent' ) { // parent mode
			const newWidth = this._calculateParentWidth( state, deltaX );
			this._applyPanelWidth( state.leftPanel, newWidth, state.containerWidth );
			this._emit( 'resize', { leftWidth: newWidth } ); // dispatch resize event
		}
		else { // sibling mode
			const { leftWidth, rightWidth } = this._calculateSiblingWidths( state, deltaX );
			this._applyPanelWidth( state.leftPanel, leftWidth, state.containerWidth );
			this._applyPanelWidth( state.rightPanel, rightWidth, state.containerWidth );
			this._emit( 'resize', { leftWidth, rightWidth } ); // dispatch resize event
		}
	}

	/** Computes the directional pixel delta from mouse movement */
	_calculateDeltaX( currentX, state ) {
		let deltaX = currentX - state.startX; // compute pixel delta

		// Invert delta for left-side handle
		if( state.mode === 'parent' && state.side === 'left' ) {
			deltaX = -deltaX;
		}
		return deltaX;
	}

	/** Computes and clamps width for parent/child sidebars */
	_calculateParentWidth( state, deltaX ) {
		const rawWidth = state.startLeftWidth + deltaX;
		return Math.max( state.minLeft, Math.min( rawWidth, state.maxLeft ) );
	}

	/** Computes and clamps two-way width distribution for sibling panels */
	_calculateSiblingWidths( state, deltaX ) {
		const totalWidth	= state.startLeftWidth + state.startRightWidth;
		let leftWidth			= state.startLeftWidth + deltaX;
		let rightWidth		= state.startRightWidth - deltaX;

		// Constrain left panel
		if( leftWidth < state.minLeft ) {
			leftWidth		= state.minLeft;
			rightWidth	= totalWidth - leftWidth;
		} else if( leftWidth > state.maxLeft ) {
			leftWidth		= state.maxLeft;
			rightWidth	= totalWidth - leftWidth;
		}

		// Constrain right panel
		if( rightWidth < state.minRight ) {
			rightWidth	= state.minRight;
			leftWidth		= totalWidth - rightWidth;
		} else if( rightWidth > state.maxRight ) {
			rightWidth	= state.maxRight;
			leftWidth		= totalWidth - rightWidth;
		}

		return { leftWidth, rightWidth };
	}
	/** Apply formatted width styles (px or %) and sync flexBasis 
	 * @param {HTMLElement}	panel						- Panel element
	 * @param {number}			widthPx					- Width in pixels
	 * @param {number}			containerWidth	- Container width
	 */
	_applyPanelWidth( panel, widthPx, containerWidth ) {
		if( !panel ) return;

		// Determine formatted width
		let formattedValue;
		if( this.options.usePercentages && containerWidth > 0 ) {	// if using percent width
			const pct = ( widthPx / containerWidth ) * 100;					// compute percent
			formattedValue = `${pct}%`;															// format percent
		} else {
			formattedValue = `${widthPx}px`;												// format pixels
		}

		panel.style.width     = formattedValue;
		panel.style.flexBasis = formattedValue;
	}
	// #endregion Mouse Move

	_onMouseUp() {
		if( !this.activeDrag ) return;

		// If parent mode, clear max width
		if( this.activeDrag.mode === 'parent' && this.activeDrag.leftPanel ) {
			this.activeDrag.leftPanel.style.maxWidth = '';
		}

		// Remove dragging classes
		this.activeDrag.dragBar.classList.remove( 'recisor-dragging' );
		this.container.classList.remove( 'recisor-container-dragging' );

		// Remove event listeners
		window.removeEventListener( 'mousemove', this._onMouseMove );
		window.removeEventListener( 'mouseup', this._onMouseUp );

		this._emit( 'dragend', this.activeDrag ); // dispatch dragend event
		this.activeDrag = null;
	}

	/** Dispatch event to container */
	_emit( name, detail ) {
		this.container.dispatchEvent( new CustomEvent( `recisor:${name}`, {
			detail,
			bubbles:  true, // allow events to bubble up to parent wrappers and document
			composed: true
		} ) );
	}

	/** Destroy event listeners and observers */
	destroy() {
		if( this.resizeObserver ) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.container.removeEventListener( 'mousedown', this._onMouseDown );
		window.removeEventListener( 'mousemove', this._onMouseMove );
		window.removeEventListener( 'mouseup', this._onMouseUp );
	}
	// #endregion Event Orchestration
}