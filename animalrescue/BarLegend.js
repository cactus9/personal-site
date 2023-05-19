class BarLegend {
    // OK so this is the basic workflow
    // 1. set up the object, and pass it the initial data in constructor
    // 2. populate the chart with marks and axes for known data
    // 3. Every time the data changes, update the object parameters and do step 2
    
    /**
    * Class constructor with basic chart configuration
    * @param {D3 selection} _parent 
    * @param {Object} _data
    * @param {function} _category
    * @param {function} _quantity
    * @param {function} _colourScale
    * @param {string[]} _categoryList
    * @param {string} _selectedCategoryType
    * @param {function} _changeCategoryType
    * @param {function} _selectCategory
    * @param {String} _selectedCategory
    */
    constructor(_parent, _data, _category, _quantity, _colourScale, _selectCategory, _selectedCategory, _categoryHover, _title="Calls by animal value") {
         
        this.parent = _parent;
        this.data = _data;  //Should be sorted in descending order by quantity
        this.category = _category;
        this.colourScale = _colourScale;
        this.quantity = _quantity;
        this.selectCategory = _selectCategory;
        this.selectedCategory = _selectedCategory;
        this.categoryHover = _categoryHover;
        this.axisScaleType = 'Linear axis scale';
        this.titleText = _title;
        
        // Margin conventions
        this.width  = +this.parent.node().getBoundingClientRect().width; // Because widths are computed, not set
        this.height = +this.parent.node().getBoundingClientRect().height;
        
        // We're setting up a fairly complex piece of html here. so it's worth explaining what's going on.
        this.title = this.parent.append('h2').attr('class', 'view-title').text(_title); // Title for chart
        
        this.barsScrollableDiv = this.parent.append('div') // Div for everything with a commmon center/baseline
            .attr('id', 'categorical-chart-scrollable')
        
        this.headerDiv = this.barsScrollableDiv.append('div') // Div for holding header elements
            .attr('id', 'categorical-chart-headers');
        
        this.labelsDiv = this.headerDiv.append('div') // Div holding axis labels
            .attr('class', 'split-align');
         
        this.labelsDiv.append('h3').text('Number of Calls');
        this.labelsDiv.append('h3').text('Call Category');
        
        this.axisSelectorDiv = this.headerDiv.append('div') // Div holding axis and category selector
            .attr('class', 'split-align')
            .attr('id', 'categorical-axis-div');
        
        this.axisSVG = this.axisSelectorDiv.append('svg').style('overflow', 'visible'); // SVG for the actual axis
        
        this.axisTypeSelector = this.axisSelectorDiv.append('select'); // Dropdown for the available options
        this.axisTypeSelector.on('change', event => this.update({axisScaleType: event.target.value}));
        this.axisTypeSelector.selectAll('option').data(['Linear axis scale', 'Log axis scale']).join('option')
            .attr('value', d=>d)
            .text(d=>d);
        
        this.barsDiv = this.barsScrollableDiv.append('div') // Div we'll actually populate with all the categories
            .attr('id', 'categorical-chart-bars');
        
        // And the rest of the party
        this.populate()
    }
    
    /**
    * Create elements in the visualisation according to the data
    */  
    populate() {
        
        const tooltip = d3.select('#tooltip');
        const transitionDuration = 500;
        
        // Set up axis
        const barBorderWidth = +getComputedStyle(document.documentElement)
            .getPropertyValue('--bar-border-width').slice(0,-2); // Slice takes off pixel unit
        
        
        const scale = (this.axisScaleType==='Linear axis scale' ? d3.scaleLinear() : d3.scaleLog())
            .domain([0.1, d3.max(this.data, this.quantity)])
            .range([0, 100]);
                
        // Plot all the categories
        this.barsDiv.selectAll('div.split-align').data(this.data, d => d).join(
            enter => enter.append('div')
                .attr('class', 'split-align cat-bar')
                .on('click', (event, d) => this.selectCategory(this.category(d)))
                .on('mouseover', (event, d) => this.categoryHover(this.category(d)))
                .on('mouseout', (event, d) => this.categoryHover(null))
                .call(div => {
                    let parentDiv = div.append('div'); // Holder for the bar
                    
                    parentDiv.append('div')
                        .attr('class', 'bar')
                        .style('background-color', d => this.colourScale(this.category(d)))
                        .style('width', d => `max( calc(${scale(this.quantity(d))}% - 2 * var(--bar-border-width)), 1px)`)
                        .style('margin-left', 'auto')
                        .style('height', 'calc(100% - 2 * var(--bar-border-width))')
                        .on('mousemove', (event, d) => {
                            tooltip.style('display', 'block')
                                .style('left', (event.pageX + 5) + 'px')   
                                .style('top', (event.pageY + 5) + 'px')
                                .html(this.quantity(d) === 1 ? '<p>1 call</p>' : `
                                    <p>${this.quantity(d)} calls</p>
                                `);
                        })
                        .on('mouseout', () => tooltip.style('display', 'none'));
                                
                    div.append('p').text(this.category);
                }),
            
            update => update.style('opacity', d => this.selectedCategory ? (this.category(d) === this.selectedCategory ? 1 : 0.2) : 1)
                            .select('.bar')
                                .style('width', d => `max( calc(${scale(this.quantity(d))}% - 2 * var(--bar-border-width)), 1px)`)
        );
        
        const parentWidth = this.axisSVG.node().getBoundingClientRect().width;

        const axisScale = (this.axisScaleType==='Linear axis scale' ? d3.scaleLinear() : d3.scaleLog())
            .domain([0.1, d3.max(this.data, this.quantity)])
            .range([parentWidth, 0]);
        
            
        const axis = d3.axisTop(axisScale)
            .ticks(4, "~s")
            .tickSizeOuter(0)
            .tickPadding(5);
            
        const axisG = this.axisSVG.selectAll('g.axis').data([0]).join('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.axisSVG.node().getBoundingClientRect().height})`);
            
        axisG.transition().duration(transitionDuration)
            .call(axis);
        
    }
    
    /**
    * Update the object's attributes and refresh the visualisation
    * Changes the axes, scales, data getters, etc
    * @param {Object} new_attrs
    */
    update(new_attrs) {
        Object.keys(new_attrs).forEach(key => this[key] = new_attrs[key]);
        this.title.text(this.titleText),
        this.populate();
    };
}