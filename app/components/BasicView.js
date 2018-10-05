// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptBasicViewDir = listUrl.join("/");

getBasicViewComponent = async function() {
// ------------------------------------------------------------------------

// get template for component
var templBasicView;
await $.asyncGet(scriptBasicViewDir + "BasicView.html", function(data){
    templBasicView = data;
}.bind(this));

var BasicView = {
  template: templBasicView,
  props: {
    classes: {
      type    : Array,
      required: false
    },
  },
  data() {
    return {

    }
  },
  computed: {
    
  },
  methods: {
    
  },
};

// ------------------------------------------------------------------------
return BasicView;
}