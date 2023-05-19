class StackedArea {
    
    /**
    * Class constructor with basic chart configuration
    * @param {D3 selection} _parent 
    * @param {Object} _data
    * @param {Object} _margin
    * @param {int[]} _xRange
    * @param {function} _xValue
    * @param {function} _yValueTop
    * @param {function} _yValueBottom
    * @param {function} _colourScale
    * @param {function} _colourValue
    * @param {function} _selectCategory
    * @param {function} _changeDisplayType
    * @param {String} [_title]
    */
    constructor(_parent, _data, _margin, _xRange, _xValue, _yValueTop, _yValueBottom, _colourScale, _colourValue, _selectCategory, _changeDisplayType, _title='Number of calls over time by animal, by') {
         
        this.parent = _parent;
        this.data = _data;
        this.margin = _margin;
        this.xValue = _xValue;
        this.xRange = _xRange;
        this.yValueTop = _yValueTop;
        this.yValueBottom = _yValueBottom;
        this.colourScale = _colourScale;
        this.colourValue = _colourValue;
        this.selectCategory = _selectCategory;
        this.yLabel = "Quantity";
        this.xLabel = "Year";
        this.title = _title;
        
        this.header = this.parent.append('div');
        this.titleElement = this.header.append('h2').text(this.title).attr('class', 'view-title');
        
        this.categorySelector = this.header.append('select');
        this.categorySelector.selectAll('option').data(['Quantity', 'Proportion (%)']).join('option')
            .text(d=>d.toLowerCase())
            .attr('value',d=>d);
        
        this.holderSVG = this.parent.append('svg');
        
        // Margin conventions
        this.width  = +this.holderSVG.node().getBoundingClientRect().width; // Because widths are computed, not set
        this.height = +this.holderSVG.node().getBoundingClientRect().height;
        this.innerWidth  = this.width - this.margin.left - this.margin.right;
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;
        
        // Set up the chart group
        this.chart = this.holderSVG.append('g')
            .attr('class', 'bar-chart')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
            
        this.categorySelector.on('change', event => _changeDisplayType(event.target.value));
        
        // And the rest of the party
        this.populate()
    }
    
    /**
    * Create elements in the visualisation according to the data
    */  
    populate() {
        // Set up scaling, axes, data
        const tooltip = d3.select('#tooltip');
        
        // Set up your scales
        const xScale = d3.scaleLinear()
            .domain(this.xRange)
            .range([0, this.innerWidth]);
        
        this.yValueRange = [0,d3.max(this.data.map(d => d3.max(d.map(e => d3.max(e)))))];
        
        const yScale = d3.scaleLinear()
            .domain(this.yValueRange)
            .range([this.innerHeight, 0]) //0 is at the top, which is why we flip
            .nice();
        
        // Now to plot the actual areas
        const areaGen = d3.area()
          .x(d => xScale(this.xValue(d)))
          .y0(d => yScale(this.yValueBottom(d)))
          .y1(d => yScale(this.yValueTop(d)));
          
        this.chart.selectAll('.category-area').data(this.data, d=>d.joinKey).join(
            enter => enter.append('path')
                  .attr('class', 'category-area')
                  .attr('fill', d=>this.colourScale(this.colourValue(d)))
                  .attr('opacity', 0.7)
                  .on('click', (event, d) => this.selectCategory(this.colourValue(d)))
                  .on('mousemove', (event, d) => {
                    tooltip.style('display', 'block')
                        .style('left', (event.pageX + 5) + 'px')   
                        .style('top', (event.pageY + 5) + 'px')
                        .html(`<p>${this.colourValue(d)}</p>`);
                  })
                  .on('mouseout', () => tooltip.style('display', 'none'))
                  .transition().duration(500)
                    .attr('d', areaGen),
            
            update => update.transition().duration(500)
                    .attr('d', areaGen),
            
        );
        
        // Quick and dirty little tick-formatter for the time labels
        this.tickFormat = tick => {switch (this.xLabel) {
            case "Year":
                return tick.toString();
            case "Month":
                return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+tick];
            case "Hour":
                return tick.toString()+":00";
            case "Day":
                //So we have mid-ticks as well
                if ((+tick).toString().length > 2) {
                    return "";
                } else {
                    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][+tick];
                }
            default:
                return "";
        }};
        
        // Axes for days
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(this.tickFormat)
            .tickSizeOuter(0) //Removes ticks that book-end axis
            .tickPadding(5);
        
        const yAxis = d3.axisLeft(yScale)
            //.ticks(6)
            .tickSizeOuter(0)
            .ticks(4, "~s")
            .tickPadding(5);
        
        // Render axis groups
        const xAxisG = this.chart.selectAll('g.x-axis').data([null]).join('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${this.innerHeight})`);
        xAxisG.transition().duration(500)
            .call(xAxis);
        
        const yAxisG = this.chart.selectAll('g.y-axis').data([null]).join('g')
            .attr('class', 'axis y-axis');
        yAxisG.transition().duration(500)
            .call(yAxis);
        
        // Labels
        xAxisG.selectAll('text.axis-label').data([null]).join('text')
            .attr('class', 'axis-label')
            .attr('x', this.innerWidth/2)
            .attr('y', 40)
            .transition()
                .text(this.xLabel);
        
        yAxisG.selectAll('text.axis-label').data([null]).join('text')
            .attr('class', 'axis-label') //Style it or something
            .attr('transform', `rotate(-90)`)
            .attr('x', -this.innerHeight/2)
            .attr('dy', -40)
            .transition()
                .text(this.yLabel + ' of calls');
        
    }
    
    /**
    * Hover interaction
    * @param {String} cat
    */  
    hover(cat) {
        //console.log(cat);
        if (cat) {
            this.chart.selectAll('.category-area').data(this.data, d=>d.joinKey).join(
                enter => enter, // No surprises
                update => update.attr('opacity', d => d.key === cat ? 1 : 0.5),
                exit => exit
            );
        } else {
            this.chart.selectAll('.category-area').attr('opacity', 0.7);
        }
        
    }
    
    /**
    * Update the object's attributes and refresh the visualisation
    * Changes the axes, scales, data getters, etc
    * @param {Object} new_attrs
    */
    update(new_attrs) {
        Object.keys(new_attrs).forEach(key => this[key] = new_attrs[key]);
        this.titleElement.text(this.title);
        this.populate();
    };
}