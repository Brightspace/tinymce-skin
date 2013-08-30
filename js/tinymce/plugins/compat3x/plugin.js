/**
 * plugin.js
 *
 * Copyright, Moxiecode Systems AB
 * Released under LGPL License.
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 */

/*global tinymce:true, console:true */

/**
 * This plugin adds missing events form the 4.x API back. Not every event is
 * properly supported but most things should work.
 *
 * Unsupported things:
 *  - No editor.onEvent
 *  - Can't cancel execCommands with beforeExecCommand
 *  - onNodeChange passes in "null" as controlManager since it's removed in 4.x
 */
(function(tinymce) {
	var reported;

	function Dispatcher(target, newEventName, argsMap, defaultScope) {
		target = target || this;

		this.add = function(callback, scope) {
			if (!reported && window && window.console) {
				reported = true;
				console.log('Deprecated TinyMCE API call: <target>.on' + newEventName + ".add(..)");
			}

			// Convert callback({arg1:x, arg2:x}) -> callback(arg1, arg2)
			function patchedEventCallback(e) {
				var callbackArgs = [];

				if (typeof argsMap == "string") {
					argsMap = argsMap.split(" ");
				}

				if (argsMap && typeof argsMap != "function") {
					for (var i = 0; i < argsMap.length; i++) {
						callbackArgs.push(e[argsMap[i]]);
					}
				}

				if (typeof argsMap == "function") {
					callbackArgs = argsMap(newEventName, e, target);
					if (!callbackArgs) {
						return;
					}
				}

				if (!argsMap) {
					callbackArgs = [e];
				}

				callbackArgs.unshift(defaultScope || target);

				if (callback.apply(scope || defaultScope || target, callbackArgs) === false) {
					e.stopImmediatePropagation();
				}
			}

			target.on(newEventName, patchedEventCallback);

			return patchedEventCallback;
		};

		// Not supported to just use add
		this.addToTop = this.add;

		this.remove = function(callback) {
			return target.off(newEventName, callback);
		};

		this.dispatch = function() {
			target.fire(newEventName);

			return true;
		};
	}

	tinymce.onBeforeUnload = new Dispatcher(tinymce, "BeforeUnload");
	tinymce.onAddEditor = new Dispatcher(tinymce, "AddEditor", "editor");
	tinymce.onRemoveEditor = new Dispatcher(tinymce, "RemoveEditor", "editor");

	tinymce.PluginManager.add("compat3x", function(editor) {
		function patchEditorEvents(oldEventNames, argsMap) {
			tinymce.each(oldEventNames.split(" "), function(oldName) {
				editor["on" + oldName] = new Dispatcher(editor, oldName, argsMap);
			});
		}

		function convertUndoEventArgs(type, event, target) {
			return [
				event.level,
				target
			];
		}

		function filterSelectionEvents(needsSelection) {
			return function(type, e) {
				if ((!e.selection && !needsSelection) || e.selection == needsSelection) {
					return [e];
				}
			};
		}

		patchEditorEvents("PreInit BeforeRenderUI PostRender Load Init Remove Activate Deactivate", "editor");
		patchEditorEvents("Click MouseUp MouseDown DblClick KeyDown KeyUp KeyPress ContextMenu Paste Submit Reset");
		patchEditorEvents("BeforeExecCommand ExecCommand", "command ui value args"); // args.terminate not supported
		patchEditorEvents("PreProcess PostProcess LoadContent SaveContent Change");
		patchEditorEvents("BeforeSetContent BeforeGetContent SetContent GetContent", filterSelectionEvents(false));
		patchEditorEvents("SetProgressState", "state time");
		patchEditorEvents("VisualAid", "element hasVisual");
		patchEditorEvents("Undo Redo", convertUndoEventArgs);

		patchEditorEvents("NodeChange", function(type, e) {
			return [
				null,
				e.element,
				editor.selection.isCollapsed(),
				e
			];
		});

		editor.on('init', function() {
			var undoManager = editor.undoManager, selection = editor.selection;

			undoManager.onUndo = new Dispatcher(editor, "Undo", convertUndoEventArgs, null, undoManager);
			undoManager.onRedo = new Dispatcher(editor, "Redo", convertUndoEventArgs, null, undoManager);
			undoManager.onBeforeAdd = new Dispatcher(editor, "BeforeAddUndo", null, undoManager);
			undoManager.onAdd = new Dispatcher(editor, "AddUndo", null, undoManager);

			selection.onBeforeGetContent = new Dispatcher(editor, "BeforeGetContent", filterSelectionEvents(true), selection);
			selection.onGetContent = new Dispatcher(editor, "GetContent", filterSelectionEvents(true), selection);
			selection.onBeforeSetContent = new Dispatcher(editor, "BeforeSetContent", filterSelectionEvents(true), selection);
			selection.onSetContent = new Dispatcher(editor, "SetContent", filterSelectionEvents(true), selection);
		});
	});
})(tinymce);