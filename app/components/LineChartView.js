getLineChartViewComponent = async function() {
	// must return promise for async/await
    return new Promise((resolve, reject) => {
    	// check if already loaded
		if(!Vue.options.components['line-chart']) {

			// chart component
			Vue.component('line-chart', {
				extends: VueChartJs.Line,
				mixins: [VueChartJs.mixins.reactiveProp],
				props: ['ranges', 'ranges_enabled'],
				data: function () {
					return {
						options: {
							//animation          : false,
							responsive         : true,
							maintainAspectRatio: false,
							elements           :  { 
								point: { radius: 0     },  // no points
								line : { fill  : false }   // no background fill
							},
							scales: {
								xAxes: [{
								  scaleLabel: {
									display: true,
									labelString: 'Time'
								  },
								  ticks: {
                                      maxTicksLimit: 20
                                  }
								}],
								yAxes: [{
								  scaleLabel: {
									display: true,
									labelString: 'Amplitude'
								  }
								}]
                            }, // scales 
                            annotation: {
								events: [/*'click', 'dblclick',*/ 'mouseover', 'mouseout'],
							} // annotation
						},		
					}
				},
				mounted () {
					// this.chartData is created in the mixin 
					this.renderChart(this.chartData, this.options);
					// save ref for future use
					this.canvas = this.$refs.canvas;
					this.chart  = Object.values(Chart.instances).filter(instance => instance.canvas === this.canvas)[0];
					// subscribe to create inital range by click
					this.canvas.onpointerup = (evt) => {
						// if not empty return
						if(this.ranges.length > 0 || !this.ranges_enabled) {
							return;
						}
						const points = this.chart.getElementsAtEventForMode(evt, 'index', { intersect: false })
						const index  = points[0]._index;
						this.ranges.push([0, index, index]);
					}
				},
				watch: {
			        ranges: function() { 
						this.updateAnnotations();
			        }
			    },
			    methods: {
			    	updateAnnotations() {
			        	// first clear annotations and highlight
						this.clearAnnotationsFromChart(this.chart.chart);
						// all ranges in array
						for(var i = 0; i < this.ranges.length; i++) {
							var range_id    = this.ranges[i][0];
							var row_start   = this.ranges[i][1];
							var row_end     = this.ranges[i][2];
							// fix impossible range
							if(row_start > row_end) {
								row_end = row_start;
								this.ranges[i][2] = row_end;
							}
							// limit
							if(row_start >= this.chart.data.labels.length) {
								row_start = this.chart.data.labels.length-1;
							}
							if(row_end >= this.chart.data.labels.length) {
								row_end = this.chart.data.labels.length-1;
							}
							// get labels at indexes (can also get values : this.chart.data.datasets[0].data[row_start].x)
							var label_start = this.chart.data.labels[row_start];
							var label_end   = this.chart.data.labels[row_end  ];
							this.updateSelectedArea(range_id, row_start, row_end, label_start, label_end);
						}    		
			    	},
			    	updateSelectedArea(range_id, row_start, row_end, label_start, label_end) {
						// always add start
						this.addAnnotationToChart     ([range_id, 1], this.chart.chart, label_start);
						// conditionally add end
						if(row_start < row_end) {
							this.addAnnotationToChart ([range_id, 2], this.chart.chart, label_end  );
						}
						// print area
						this.addHighlightArea(this.chart, row_start, row_end, label_start, label_end);
					},
					addAnnotationToChart(id, chart, label) {
						// create function to call on drag 
						var funcOnDrag = (event) => {
							// get new index value
							var xaxis    = chart.chart.scales['x-axis-0'];
							var x_index  = xaxis.getValueForPixel(event.x);
							// get value to overwrite
							var range_id = event.subject.config.my_id[0];
							var a_index  = event.subject.config.my_id[1];
							// update ranges (inc annotations)
							this.ranges[range_id].splice(a_index, 1, x_index);
							this.ranges.splice(range_id, 1, this.ranges[range_id]);
						};
						// NOTE : my_id must contain range_id and 1 for start, 2 for end (annotation index in this.ranges)
						const annotation = {
							my_id      : id        ,
							scaleID    : 'x-axis-0',
							type       : 'line'    ,
							mode       : 'vertical',
							value      : label     ,
							borderColor: 'rgba(234, 109, 52, 1)',
							borderWidth: 3,
							/*onClick: function(e) { } // NOT WORKING */
							// NOTE : chartjs-plugin-draggable plugin, also NOT WORKING, but implementation below makes it work
							draggable: true, 
							onDrag   : throttle(funcOnDrag, 200),
							onDragStart: () => {
								this.$emit('dragStart');
							},
							onMouseover: (evt) => {
								this.canvas.style.cursor = 'pointer';								
							},
							onMouseout: (evt) => {
								this.canvas.style.cursor = '';								
							},
						};
						chart.options.annotation             = chart.options.annotation             || { /*events: ['click'] // NOT WORKING HERE, IN CHART CONSTRUCTOR*/ };
						chart.options.annotation.annotations = chart.options.annotation.annotations || [];
						chart.options.annotation.annotations.push(annotation);
						chart.update();	
					},
					clearAnnotationsFromChart(chart) {
						if (chart.options.annotation) {
							chart.options.annotation.annotations = [];
						};
					},
					addHighlightArea(chart, row_start, row_end, label_start, label_end) {
						// custom draw
						var customDraw = function() {
							// fix late render 
							if(!this.canvas){ return; }
							// call original before
							try {
								Object.getPrototypeOf(chart).draw.apply(this, arguments);	
							}
							catch(err) {
								console.info(err.message);
								debugger;
								return;
							}
							// conditionally draw highlight area
							if(row_start < row_end) {
								// draw area
								var xaxis = chart.chart.scales['x-axis-0'];
								var yaxis = chart.chart.scales['y-axis-0'];
								var x_pixel_start = xaxis.getPixelForValue(label_start);
								var x_pixel_end   = xaxis.getPixelForValue(label_end);
								chart.ctx.save();
								chart.ctx.fillStyle = 'rgba(234, 109, 52, 0.1)';
								chart.ctx.fillRect(x_pixel_start, yaxis.top, x_pixel_end-x_pixel_start, yaxis.bottom-yaxis.top);
								chart.ctx.restore();	
							}
						};
						// override draw method and work directlywith canvas
						chart.draw = throttle(customDraw, 50);
					},
			    }
			});

		} // check if loaded
		// resolve
		resolve();
	}); // promise
}