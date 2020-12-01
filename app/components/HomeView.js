// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptHomeViewDir = listUrl.join("/");

getHomeViewComponent = async function() {
// ------------------------------------------------------------------------

// get template for component
var templHomeView;
await $.asyncGet(scriptHomeViewDir + "HomeView.html", function(data){
    templHomeView = data;
}.bind(this));

var HomeView = {
  template: templHomeView,
  props: {
    pid_loaded: {
      type    : Boolean,
      required: true
    },
    window_width: {
      type    : Number,
      required: true
    },
  },
  data() {
    return {
    }
  },
  computed: {
    
  },
  methods: {
    onClicked : function() {
      this.$emit('load_pid');
    },
  },
};

// ------------------------------------------------------------------------
return HomeView;
}