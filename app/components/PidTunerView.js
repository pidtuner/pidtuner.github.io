// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptPidTunerViewDir = listUrl.join("/");

getPidTunerViewComponent = async function() {
// ------------------------------------------------------------------------

// get dependencies
var ImportDataView  = await getImportDataViewComponent();
var SelectStepView  = await getSelectStepViewComponent();
var SelectModelView = await getSelectModelViewComponent();
var TunePidView     = await getTunePidViewComponent();

// get template for component
var templPidTunerView;
await $.asyncGet(scriptPidTunerViewDir + "PidTunerView.html", function(data){
    templPidTunerView = data;
}.bind(this));

var PidTunerView = {
  template: templPidTunerView,
  props: {
    classes: {
      type    : Array,
      required: false
    },
  },
  data() {
    return {
        // array to be able to iterate for left menu creation
      proj_id             : 0,
      all_steps           : ['import_data','select_step','select_model','tune_pid'],
        // states used for work-flow, enable/disable menu items, etc.
      current_step        : "import_data",
      latest_step         : "import_data",
      show_message        : true,
      next_enabled        : false,
      step_loaded         : false,
        // step 1 result. import_data
      time                : [],
      input               : [],
      output              : [],
        // step 2 result. select step
      cached_range_list   : [],
      selected_range      : [],
      uniform_time        : [],
      uniform_input       : [],
      uniform_output      : [],
        // step 3 result. select model
      cached_model_list   : [],
      selected_model      : {},
      // step 4 result    : tune pid
      cached_gains_slider : 0,
      cached_time_slider  : 0,
      cached_r_size       : 1.0,
      cached_d_size       : 0.0,
      pid_gains           : [],
      pidsim_time         : [],
      pidsim_input        : [],
      pidsim_output       : [],
      pidsim_ref          : [],
      pidsim_dist         : [],
    }
  },
  beforeMount: function() {
    // create steps info
    this.stepInfo = {};
    this.stepInfo['import_data' ] = {
      num   : 1,
      comp  : 'v-import-data',
      title : 'Import Data',
      icon  : 'table icon',
      info  : `
      Import your <a href="https://en.wikipedia.org/wiki/Step_response" target="_blank">step response data</a> here. 
      Copy and paste to the table below using the ctrl+v shortcut. 
      Match each column of the table with the corresponding data. 
      All three columns must be of the same length. A minimum of 50 samples is required.
      `
    };
    this.stepInfo['select_step' ] = {
      num   : 2,
      comp  : 'v-select-step',
      title : 'Select Step',
      icon  : 'share square icon',
      info  : `
      The step response data might contain multiple steps,
      but for tuning purposes, only one step is needed.
      Please select the smallest time range, where only one step response data is contained.
      It is possible to define custom ranges by dragging the vertical lines.
      `
    };
    this.stepInfo['select_model'] = {
      num   : 3,
      comp  : 'v-select-model',
      title : 'Select Model',
      icon  : 'sitemap icon',
      info  : `
      The model type that best fits the step response data is automatically selected.
      Nevertheless, it is possible to select a different model if it is known that the process
      belongs to a different system class. Please select the preferred model.
      `
    };
    this.stepInfo['tune_pid'    ] = {
      num   : 4,
      comp  : 'v-tune-pid',
      title : 'Tune PID',
      icon  : 'sliders horizontal icon',
      info  : `
      These PID gains provide a starting point for tuning your PID.
      Feel free to change the PID gains as desired and see the resulting step 
      and disturbance response changing in real time. 
      The PID implementation used in the simulation is the 
      <a href="https://en.wikipedia.org/wiki/PID_controller#Discrete_implementation" target="_blank">
		velocity algorithm
      </a> 
      in the 
      <a href="https://en.wikipedia.org/wiki/PID_controller#Ideal_versus_standard_PID_form" target="_blank">
		standard form
      </a>.
      `
    };
    // create dixie db 
    this.db = new Dexie("pidtuner");
	this.db.version(1).stores({
	  projdata: `proj_id,all_steps,current_step,latest_step,show_message,next_enabled,step_loaded,time,input,output,cached_range_list,selected_range,uniform_time,uniform_input,uniform_output,cached_model_list,selected_model,cached_gains_slider,cached_time_slider,cached_r_size,cached_d_size,pid_gains,pidsim_time,pidsim_input,pidsim_output,pidsim_ref,pidsim_dist`
	});  
	// create method to reuse
	this.getDbObj = () => {
		return this.db.projdata.where("proj_id").equals(0);
	};
	// try to load if any
	this.getDbObj().first().then((data) => {
			const dataKeys = Object.keys(this.$data);
			if(data) {
				// load vue data
				for(var i = 0; i < dataKeys.length; i++) {
					const currKey = dataKeys[i];
					this[currKey] = data[currKey];
				}
				// TODO : implement undo ?
			}
			else {
				// add it for the first time
				this.createDbEntry();
			}
			// subscribe to changes
			for(var i = 0; i < dataKeys.length; i++) {
				const currKey = dataKeys[i];
				// subscribe to changes
				this.$watch(currKey, (value) => {
					this.getDbObj().modify((db_obj) => {
						db_obj[currKey] = value;
					})
				}, {
					deep: true
				});
			}
		})
		.catch((err) => {
			console.warn(err);
		}); 
  },
  mounted: function() {
    // setup close button for info
    $(this.$refs.close_button).on('click', function() {
      $(this).closest('.message').transition('fade') ;
    }).on('click', () => {
      setTimeout(() => {
        this.show_message = false;
      }, 300);
    });       
  },
  methods: {
  	// create initial (one time) db entry
  	createDbEntry : function() {
  		this.db.projdata.add(this.$data).then(() => {
			console.info("Project data being saved in memory from now on");
		})
		.catch((err) => {
			console.warn(err);
		});  
  	},
    // check if should disable
    isStepDisabled: function(stepName) {
      return this.stepInfo[stepName].num > this.stepInfo[this.latest_step].num;
    },
    // get step number
    getNumber: function(stepName) {
      return this.stepInfo[stepName].num;
    },
    // get step component
    getComponent: function(stepName) {
      return this.stepInfo[stepName].comp;
    },
    // get step title
    getTitle: function(stepName) {
      return this.stepInfo[stepName].title;
    },
    // get step icon
    getIcon: function(stepName) {
      return this.stepInfo[stepName].icon;
    },
    // get step information
    getInfo: function(stepName) {
      return this.stepInfo[stepName].info;
    },
    // get next step
    getNextStep: function(stepName) {
      // NOTE : getNumber returns index+1, so index of next step
      var stepNum = this.getNumber(stepName);
      return this.all_steps[stepNum];
    },
    // get previous step
    getPrevStep: function(stepName) {
      // NOTE : getNumber returns index+1, so index of next step
      var stepNum = this.getNumber(stepName);
      return this.all_steps[stepNum-2];
    },
    on_backClicked() {
    	this.step_loaded  = false; 
    	Vue.nextTick( () => { 
			this.current_step = this.getPrevStep(this.current_step); 
			this.next_enabled = true;	
    	} );
    },
    on_nextClicked() {
    	this.step_loaded = false; 
    	Vue.nextTick( () => { 
    		this.current_step = this.getNextStep(this.current_step); 
    		if(this.getNumber(this.latest_step) < this.getNumber(this.current_step)) {
    			this.latest_step  = this.current_step; 
    		}		
    		this.next_enabled = false; 
		} );
    },
    resetStep2() {
	  this.cached_range_list.splice(0, this.cached_range_list.length);
	  this.selected_range   .splice(0, this.selected_range   .length);
	  this.uniform_time     .splice(0, this.uniform_time     .length);
	  this.uniform_input    .splice(0, this.uniform_input    .length);
	  this.uniform_output   .splice(0, this.uniform_output   .length);    	
    },
    resetStep3() {
	  this.cached_model_list.splice(0, this.cached_model_list.length);
	  this.selected_model = {};	  
    },
    resetStep4() {
      this.cached_gains_slider = 0;
      this.cached_time_slider  = 0;  
      this.cached_r_size       = 1.0;
      this.cached_d_size       = 0.0;
      this.pid_gains.splice(0, this.pid_gains.length);
      this.pidsim_time  .splice(0, this.pidsim_time  .length);      
      this.pidsim_input .splice(0, this.pidsim_input .length);
      this.pidsim_output.splice(0, this.pidsim_output.length);
      this.pidsim_ref   .splice(0, this.pidsim_ref   .length);      
      this.pidsim_dist  .splice(0, this.pidsim_dist  .length);      
    }
  },
  watch: {
	latest_step: function(){
		if(this.latest_step == 'import_data') {
		  this.resetStep2();
		  this.resetStep3();
          this.resetStep4();
		}
		else if(this.latest_step == 'select_step') {
          this.resetStep3();
          this.resetStep4();
		}
		else if(this.latest_step == 'select_model') {
          this.resetStep4();
		}
		else if(this.latest_step == 'tune_pid') {
          // nothing to do here
		}
	},
  },
  components: {
    'v-import-data'  : ImportDataView ,
    'v-select-step'  : SelectStepView ,
    'v-select-model' : SelectModelView,
    'v-tune-pid'     : TunePidView    ,
  }
};

// ------------------------------------------------------------------------
return PidTunerView;
}