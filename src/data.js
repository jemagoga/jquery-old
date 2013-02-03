var data_user, data_priv,
	rbrace = /(?:\{[\s\S]*\}|\[[\s\S]*\])$/,
	rmultiDash = /([A-Z])/g;

function Data() {
	// Nodes|Objects
	this.owners = [];
	// Data objects
	this.cache = [];
}

Data.index = function( array, node ) {
	return array.indexOf( node );
};


Data.prototype = {
	add: function( owner ) {
		this.owners.push( owner );
		return (this.cache[ this.owners.length - 1 ] = {});
	},
	set: function( owner, data, value ) {
		var prop,
				index = Data.index( this.owners, owner );

		// If there is no entry for this "owner", create one inline
		// and set the index as though an owner entry had always existed
		if ( index === -1 ) {
			this.add( owner );
			index = this.owners.length - 1;
		}
		// Handle: [ owner, key, value ] args
		if ( typeof data === "string" ) {
			this.cache[ index ][ data ] = value;

		// Handle: [ owner, { properties } ] args
		} else {
			// In the case where there was actually no "owner" entry and
			// this.add( owner ) was called to create one, there will be
			// a corresponding empty plain object in the cache.
			if ( jQuery.isEmptyObject( this.cache[ index ] ) ) {
				this.cache[ index ] = data;

			// Otherwise, copy the properties one-by-one to the cache object
			} else {
				for ( prop in data ) {
					this.cache[ index ][ prop ] = data[ prop ];
				}
			}
		}
		return this;
	},
	get: function( owner, key ) {
		var cache,
				index = Data.index( this.owners, owner );

		// A valid cache is found, or needs to be created.
		// New entries will be added and return the current
		// empty data object to be used as a return reference
		// return this.add( owner );
		// This logic was required by expectations made of the
		// old data system.
		cache = index === -1 ?
			this.add( owner ) : this.cache[ index ];

		return key === undefined ?
			cache : cache[ key ];
	},
	access: function( owner, key, value ) {
		if ( value === undefined && (key && typeof key !== "object") ) {
			// Assume this is a request to read the cached data
			return this.get( owner, key );
		} else {

			// If only an owner was specified, return the entire
			// cache object.
			if ( key === undefined ) {
				return this.get( owner );
			}

			// Allow setting or extending (existing objects) with an
			// object of properties, or a key and val
			this.set( owner, key, value );
			return value !== undefined ? value : key;
		}
		// Otherwise, this is a read request.
		return this.get( owner, key );
	},
	remove: function( owner, key ) {
		var i, l, name,
				camel = jQuery.camelCase,
				index = Data.index( this.owners, owner ),
				cache = this.cache[ index ];

		if ( key === undefined ) {
			cache = {};
		} else {
			if ( cache ) {
				// Support array or space separated string of keys
				if ( !Array.isArray( key ) ) {
					// Try the string as a key before any manipulation
					//

					if ( key in cache ) {
						name = [ key ];
					} else {
						// Split the camel cased version by spaces unless a key with the spaces exists
						name = camel( key );
						name = name in cache ?
							[ name ] : name.split(" ");
					}
				} else {
					// If "name" is an array of keys...
					// When data is initially created, via ("key", "val") signature,
					// keys will be converted to camelCase.
					// Since there is no way to tell _how_ a key was added, remove
					// both plain key and camelCase key. #12786
					// This will only penalize the array argument path.
					name = key.concat( key.map( camel ) );
				}
				i = 0;
				l = name.length;

				for ( ; i < l; i++ ) {
					delete cache[ name[i] ];
				}
			}
		}
		this.cache[ index ] = cache;
	},
	hasData: function( owner ) {
		var index = Data.index( this.owners, owner );

		if ( index > -1 ) {
			return !jQuery.isEmptyObject( this.cache[ index ] );
		}
		return false;
	},
	discard: function( owner ) {
		var index = Data.index( this.owners, owner );

		if ( index >= 0 ) {
			this.owners.splice( index, 1 );
			this.cache.splice( index, 1 );
		}
		return this;
	}
};

// This will be used by remove()/cleanData() in manipulation to sever
// remaining references to node objects. One day we'll replace the dual
// arrays with a WeakMap and this won't be an issue.
// (Splices the data objects out of the internal cache arrays)
function data_discard( owner ) {
	data_user.discard( owner );
	data_priv.discard( owner );
}

// These may be used throughout the jQuery core codebase
data_user = new Data();
data_priv = new Data();


jQuery.extend({
	// This is no longer relevant to jQuery core, but must remain
	// supported for the sake of jQuery 1.9.x API surface compatibility.
	acceptData: function() {
		return true;
	},
	// Unique for each copy of jQuery on the page
	// Non-digits removed to match rinlinejQuery
	expando: "jQuery" + ( core_version + Math.random() ).replace( /\D/g, "" ),

	hasData: function( elem ) {
		return data_user.hasData( elem ) || data_priv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return data_user.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		return data_user.remove( elem, name );
	},

	// TODO: Replace all calls to _data and _removeData with direct
	// calls to
	//
	// data_priv.access( elem, name, data );
	//
	// data_priv.remove( elem, name );
	//
	_data: function( elem, name, data ) {
		return data_priv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		return data_priv.remove( elem, name );
	}
});

jQuery.fn.extend({
	data: function( key, value ) {
		var attrs, name,
			elem = this[0],
			i = 0,
			data = null;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = data_user.get( elem );

				if ( elem.nodeType === 1 && !data_priv.get( elem, "hasDataAttrs" ) ) {
					attrs = elem.attributes;
					for ( ; i < attrs.length; i++ ) {
						name = attrs[i].name;

						if ( name.indexOf( "data-" ) === 0 ) {
							name = jQuery.camelCase( name.substring(5) );
							dataAttr( elem, name, data[ name ] );
						}
					}
					data_priv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each(function() {
				data_user.set( this, key );
			});
		}

		return jQuery.access( this, function( value ) {
			var data,
					camelKey = jQuery.camelCase( key );

			// Get the Data...
			if ( value === undefined ) {

				// Attempt to get data from the cache
				// with the key as-is
				data = data_user.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, key, undefined );
				if ( data !== undefined ) {
					return data;
				}

				// As a last resort, attempt to find
				// the data by checking AGAIN, but with
				// a camelCased key.
				data = data_user.get( elem, camelKey );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return undefined;
			}

			// Set the data...
			this.each(function() {
				// First, attempt to store a copy or reference of any
				// data that might've been store with a camelCased key.
				var data = data_user.get( this, camelKey );

				// For HTML5 data-* attribute interop, we have to
				// store property names with dashes in a camelCase form.
				// This might not apply to all properties...*
				data_user.set( this, camelKey, value );

				// *... In the case of properties that might ACTUALLY
				// have dashes, we need to also store a copy of that
				// unchanged property.
				if ( /-/.test( key ) && data !== undefined ) {
					data_user.set( this, key, value );
				}
			});
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each(function() {
			data_user.remove( this, key );
		});
	}
});

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {

		name = "data-" + key.replace( rmultiDash, "-$1" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = data === "true" ? true :
				data === "false" ? false :
				data === "null" ? null :
				// Only convert to a number if it doesn't change the string
				+data + "" === data ? +data :
				rbrace.test( data ) ?
					JSON.parse( data ) : data;
			} catch( e ) {}

			// Make sure we set the data so it isn't changed later
			data_user.set( elem, key, data );
		} else {
			data = undefined;
		}
	}

	return data;
}
