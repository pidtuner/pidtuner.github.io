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
      list_techstack : [
        {
          title   : 'C++',
          descrip : `The main routines are implemented using C++.`,
          logo    : 'https://isocpp.org/files/img/cpp_logo.png',
          url     : 'https://isocpp.org/'
        },
        {
          title   : 'CLAPACK',
          descrip : `Low level linear algebra subroutines are provided by CLAPACK.`,
          logo    : 'https://www.icl.utk.edu/sites/all/themes/icl/favicon.ico',
          url     : 'http://icl.cs.utk.edu/lapack-for-windows/clapack/index.html'
        },
        {
          title   : 'Armadillo',
          descrip : `High level linear algebra subroutines are provided by Armadillo C++.`,
          logo    : './licenses/armadillo_logo2.png',
          url     : 'http://arma.sourceforge.net/'
        },
        {
          title   : 'Emscripten',
          descrip : `The C++ routines are compiled to WebAssembly using Emscripten.`,
          logo    : 'https://kripken.github.io/emscripten-site/_static/Emscripten_logo_full.png',
          url     : 'https://kripken.github.io/emscripten-site/'
        },
        {
          title   : 'Vue',
          descrip : `The frontend logic of this web application is implemented with Vue.`,
          logo    : 'https://vuejs.org/images/logo.png',
          url     : 'https://vuejs.org/'
        }
        ,
        {
          title   : 'Semantic UI',
          descrip : `The frontend styles are provided by with the Semantic UI framework.`,
          logo    : 'https://semantic-ui.com/images/logo.png',
          url     : 'https://semantic-ui.com/'
        }
      ],
      list_sponsors : [
        {
          title   : 'Your Name',
          descrip : `Some short text can go here.`,
          logo    : './assets/logo/logo_text.svg',
          url     : 'https://www.patreon.com/pidtuner'
        },
        {
          title   : 'Your Logo',
          descrip : `Click here to support.`,
          logo    : './assets/logo/logo_text.svg',
          url     : 'https://www.patreon.com/pidtuner'
        },
        {
          title   : 'Your Space',
          descrip : `You can put a link to your website.`,
          logo    : './assets/logo/logo_text.svg',
          url     : 'https://www.patreon.com/pidtuner'
        },
        {
          title   : 'Sponsor Us',
          descrip : `This appears in the front page.`,
          logo    : './assets/logo/logo_text.svg',
          url     : 'https://www.patreon.com/pidtuner'
        },
      ],
    }
  },
  computed: {
    
  },
  methods: {
    onClicked : function() {
      this.$emit('load_pid');
    },
    goToShop  : function() {
      window.open(
        'https://teespring.com/pidtuner',
        '_blank' // open in a new window.
      );
    }
  },
};

// ------------------------------------------------------------------------
return HomeView;
}