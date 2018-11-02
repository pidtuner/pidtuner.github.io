getLogChartViewComponent = async function() {
	// must return promise for async/await
    return new Promise((resolve, reject) => {
    	// check if already loaded
		if(!Vue.options.components['log-chart']) {

			// chart component
			Vue.component('log-chart', {
				extends: VueChartJs.Line,
				mixins: [VueChartJs.mixins.reactiveProp],
				props: ['xrange', 'yrange', 'ylabel'],
				data: function () {
					return {
						options: {
							responsive         : true,
							maintainAspectRatio: false,
							elements           :  { 
								point: { radius: 0     },  // no points
								line : { fill  : false }   // no background fill
							},
							scales: {
								xAxes: [{
								  type : 'logarithmic',
								  scaleLabel: {
									display    : true,
									labelString: 'Frequency'
								  }
								}],
								yAxes: [{
								  scaleLabel: {
									display    : true,
									labelString: 'Value'
								  }
								}]
                            }, // scales
						},		
					}
				},
				mounted () {
					// this.chartData is created in the mixin 
					this.renderChart(this.chartData, this.options);
					// save ref for future use
					this.canvas = this.$refs.canvas;
					this.chart  = Object.values(Chart.instances).filter(instance => instance.canvas === this.canvas)[0];
					// init props
					this.updateXRange(this.xrange);
					this.updateYRange(this.yrange);
					this.updateYLabel(this.ylabel);
				},
				watch: {
					xrange: function(xrange) {
						this.updateXRange(xrange);
			        },
					yrange: function(yrange) {
						this.updateYRange(yrange);
			        },
			        ylabel: function(label) {
			        	this.updateYLabel(label);   	
			        }
			    },
			    methods: {
			    	updateXRange: function(xrange) {
			    		if(!xrange) {return;}
						if(xrange.min ) { this.chart.options.scales.xAxes[0].ticks.min = parseFloat(xrange.min.toPrecision(2)) ; }
						if(xrange.max ) { this.chart.options.scales.xAxes[0].ticks.max = parseFloat(xrange.max.toPrecision(2)) ; }
						this.chart.update();
			        },
			        updateYRange: function(yrange) {
			        	if(!yrange) {return;}
						if(yrange.min ) { this.chart.options.scales.yAxes[0].ticks.min = parseFloat(yrange.min.toPrecision(2)) ; }
						if(yrange.max ) { this.chart.options.scales.yAxes[0].ticks.max = parseFloat(yrange.max.toPrecision(2)) ; }
						this.chart.update();
			        },
			    	updateYLabel: function(label) {
			    		if(!label) {return;}
						this.chart.options.scales.yAxes[0].scaleLabel.labelString = label;
						this.chart.update();
			    	}
		    	},
			});
		} // check if loaded
		// resolve
		resolve();
	}); // promise
}