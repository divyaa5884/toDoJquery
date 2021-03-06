/*global jQuery, Handlebars, Router */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var util = {
		uuid: function () {
			/*jshint bitwise:false */
			var i, random;
			var uuid = '';

			for (i = 0; i < 32; i++) {
				random = Math.random() * 16 | 0;
				if (i === 8 || i === 12 || i === 16 || i === 20) {
					uuid += '-';
				}
				uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
			}

			return uuid;
		},
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		},
		store: function (namespace, data) {
			if (arguments.length > 1) {
				return localStorage.setItem(namespace, JSON.stringify(data));
			} else {
				var store = localStorage.getItem(namespace);
				return (store && JSON.parse(store)) || [];
			}
		}
	};

	var App = {
		init: function () {
			this.todos = util.store('todos-jquery');
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.bindEvents();

			new Router({
				'/:filter': function (filter) {
					this.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');
		},
		bindEvents: function () {
			$('.new-todo').on('keyup', this.create.bind(this));
			$('.toggle-all').on('change', this.toggleAll.bind(this));
			$('.footer').on('click', '.clear-completed', this.destroyCompleted.bind(this));
			$('.todo-list')
				.on('change', '.toggle', this.toggle.bind(this))
				.on('dblclick', 'label', this.editingMode.bind(this))
				.on('keyup', '.edit', this.editKeyup.bind(this))
				.on('focusout', '.edit', this.update.bind(this))
				.on('click', '.destroy', this.destroy.bind(this));
		},
		renderColor: function(){
			var listOfCompletedToDos = this.getCompletedTodos();
			// sorting based on timestamp to check which one is clicked recently
            listOfCompletedToDos.sort(function(a, b) {
                var ele1 = a.completion_timestamp;
                var ele2 = b.completion_timestamp;
                if (ele1 < ele2) {
                    return -1;
                }
                if (ele1 > ele2) {
                    return 1;
                }
                // equal timestamp
                return 0;
            });

            var len = listOfCompletedToDos.length - 1;

            // filtering list based on id and changing color based on ordering
            // currently ticked : green, 2nd last ticked : magenta, 3rd last ticked : yellow
			var colors = ["yellow", "magenta", "green"];
			var colorIndex = 2;
			var loopToRun = (len>=2) ? len-2 : 0;
			for(var i = len; i >= loopToRun; i--){
            	var currElId = listOfCompletedToDos[i].id;
            	$('.todo-list li').filter(function(){
	            	return $(this).data('id') === currElId;
	            }).find(".view label").css("color","black").css("color", colors[colorIndex]);
	            colorIndex--;
            }
		},
		render: function () {
			var todos = this.getFilteredTodos();
			$('.todo-list').html(this.todoTemplate(todos));
			$('.main').toggle(todos.length > 0);
			$('.toggle-all').prop('checked', this.getActiveTodos().length === 0);
			// change color of currently created task
			if(this.filter === 'all'){
				$('.todo-list li').last().addClass('fading');
			}
			this.renderColor(); // changing color for 3 recent completed lists
			this.renderFooter();
			$('.new-todo').focus();
			util.store('todos-jquery', this.todos);
		},
		renderFooter: function () {
			var todoCount = this.todos.length;
			var activeTodoCount = this.getActiveTodos().length;
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			$('.footer').toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');

			this.todos.forEach(function (todo) {
				todo.completed = isChecked;
			});

			this.render();
		},
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		destroyCompleted: function () {
			this.todos = this.getActiveTodos();
			this.render();
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		getIndexFromEl: function (el) {
			var id = $(el).closest('li').data('id');
			var todos = this.todos;
			var i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
					return i;
				}
			}
		},
		create: function (e) {
			var $input = $(e.target);
			var val = $input.val().trim();

			if (e.which !== ENTER_KEY || !val) {
				return;
			}
			var currentDateTime = new Date();
			var currDate = moment(currentDateTime).format('LL');
			var currTime = moment(currentDateTime).format('hh:mm a');

			//  added keys for date and time of creation and completion of tasks
			this.todos.push({
				id: util.uuid(),
				title: val,
				completed: false,
				creationDate: currDate,
				creationTime: currTime,
				completion_timestamp: 0, // Timestamp of completion which helps in ordering lists
				completionDate: null,
				completionTime: null

			});

			$input.val('');

			this.render();
		},
		toggle: function (e) {
			var i = this.getIndexFromEl(e.target);
			this.todos[i].completed = !this.todos[i].completed;

			// if timestamp exists, set value to null on toggle else set to current timestamp
			this.todos[i].completion_timestamp = this.todos[i].completion_timestamp ? null : e.timeStamp;

			// setting completion date and time for task ticked
			var isChecked = $(e.target).prop('checked');
			if(isChecked){
				var currentDateTime = new Date();
				var currDate = moment(currentDateTime).format('LL');
				var currTime = moment(currentDateTime).format('hh:mm a');
				this.todos[i].completionDate = currDate;
				this.todos[i].completionTime = currTime;
			} else{
				// if unchecked set the value to null
				this.todos[i].completionDate = null;
				this.todos[i].completionTime = null;
			}
			this.render();
            
		},
		editingMode: function (e) {
			var $input = $(e.target).closest('li').addClass('editing').find('.edit');
			// puts caret at end of input
			var tmpStr = $input.val();
			$input.val('');
			$input.val(tmpStr);
			$input.focus();
		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				$(e.target).data('abort', true).blur();
			}
		},
		update: function (e) {
			var el = e.target;
			var $el = $(el);
			var val = $el.val().trim();
			
			if ($el.data('abort')) {
				$el.data('abort', false);
			} else if (!val) {
				this.destroy(e);
				return;
			} else {
				this.todos[this.getIndexFromEl(el)].title = val;
			}

			this.render();
		},
		destroy: function (e) {
			this.todos.splice(this.getIndexFromEl(e.target), 1);
			this.render();
		}
	};

	App.init();
});
