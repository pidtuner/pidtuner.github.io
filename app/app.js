(async function () { // IFFE
// ------------------------------------------------------------------------

// init Vue
var HomeView     = await getHomeViewComponent();
var PidTunerView = await getPidTunerViewComponent();
var ErrorView    = await getErrorViewComponent();

// main Vue instance
window.mainVue = new Vue({
  el: '#app',
  data () {
    return {
      current_page : "home",
      list_social : [
          {
            name : "linkedin",
            url  : "https://www.linkedin.com/company/pidtuner",
            icon : "linkedin"
          },
          {
            name : "twitter",
            url  : "https://twitter.com/pidtuner",
            icon : "twitter square"
          },
          {
            name : "reddit",
            url  : "https://www.reddit.com/user/pidtuner",
            icon : "reddit square"
          },
          {
            name : "github",
            url  : "https://github.com/pidtuner/pidtuner.github.io",
            icon : "github"
          },
          {
            name : "hackernews",
            url  : "https://news.ycombinator.com/user?id=pidtuner",
            icon : "hacker news square"
          },
          {
            name : "patreon",
            url  : "https://www.patreon.com/pidtuner",
            icon : "patreon"
          },
          {
            name : "mail",
            url  : "mailto:pidtuner@pidtuner.com",
            icon : "envelope"
          },
      ],
      wasm_supported : true,
      pid_loaded     : false,
      window_width   : 0, // https://stackoverflow.com/questions/47488652/vuejs-add-class-on-window-resize
    };
  },
  beforeMount: function() {
    this.page2comp = {};
    this.page2comp['home'     ] = 'v-home';
    this.page2comp['pid_tuner'] = 'v-pid-tuner';
    this.page2comp['error'    ] = 'v-error';
  },
  beforeDestroy: function() {
    window.removeEventListener('resize', this.window_width);
  },
  mounted: async function() {
    if(wasm) {
      // reaload page if pidtuner module does not load in 3 secs
      setTimeout(() => {
        if(!this.pid_loaded) {
          location.reload();
        }
      }, 5000);
      // wait for module load
      //console.time('PidTuner.await()');
      await PidTuner.await();
      //console.timeEnd('PidTuner.await()');
      // setup tuner
      window.pid = new Arma.pid_tuner();
      // enable pid tuner
      this.pid_loaded = true;
    }
    else {
      // enable pid tuner
      this.pid_loaded = true;
      // but show error instead
      this.wasm_supported = false;
    }
    // width
    this.$nextTick(function() {
      window.addEventListener('resize', this.getWindowWidth);
      //Init
      this.getWindowWidth();
    });
  },
  methods: {
    getComponent : function(page) {
      if(!this.wasm_supported) {
        page = 'error';
      }
      return this.page2comp[page];
    },
    getWindowWidth(event) {
      this.window_width = document.documentElement.clientWidth;
    },
  },
  components: {
    'v-home'      : HomeView,
    'v-pid-tuner' : PidTunerView,
    'v-error'     : ErrorView,
  }
});

// ------------------------------------------------------------------------
})(); // IFFE
