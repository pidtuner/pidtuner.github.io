// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptErrorViewDir = listUrl.join("/");

getErrorViewComponent = async function() {
// ------------------------------------------------------------------------

// get template for component
var templErrorView;
await $.asyncGet(scriptErrorViewDir + "ErrorView.html", function(data){
    templErrorView = data;
}.bind(this));

var ErrorView = {
  template: templErrorView,
  props: {

  },
  data() {
    return {
      title   : 'Uuuups',
      message : 'We are sorry. Your browser is not supported. Please use a recent version of Firefox or Chrome. WebAssembly support not found.'
    }
  },
  computed: {
    
  },
  methods: {
    
  },
};

// ------------------------------------------------------------------------
return ErrorView;
}