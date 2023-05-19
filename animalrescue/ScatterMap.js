class ScatterMap {
    
    // OK so this is the basic workflow
    // 1. set up the object, and pass it the initial data in constructor
    // 2. populate the chart with marks and axes for known data
    // 3. Every time the data changes, update the object parameters and do step 2
    
    /**
    * Class constructor with basic chart configuration
    * @param {D3 selection} _parent 
    * @param {Object} _mapData
    * @param {Object} _plotData
    * @param {function} _colourScale
    * @param {function} _colourValue
    * @param {function} [_filter]
    */
    constructor(_parent, _mapData, _plotData, _colourScale, _colourValue, _filter = d=>true) {
         
        this.parent = _parent;
        this.mapData = _mapData;
        this.plotData = _plotData;
        this.colourScale = _colourScale;
        this.colourValue = _colourValue;
        this.filter = _filter;
        this.animChoice = 0; // because CSS is a work in progress
        
        // Margin conventions
        this.width  = +this.parent.node().getBoundingClientRect().width; // Because widths are computed, not set
        this.height = +this.parent.node().getBoundingClientRect().height;
        
        // Set up the map group
        // We know we're not touching the map shapes once we draw them, so just handle it all here in the constructor
        this.projection = d3.geoMercator().fitExtent([[10,10],[this.width-10, this.height-10]], this.mapData); // margins of 10 on first load
        this.pathGenerator = d3.geoPath().projection(this.projection);
        this.mapGroup = this.parent.append('g');
        this.mapGroup.selectAll('.borough').data(this.mapData.features).join('path')
            .attr('class', 'borough')
            .attr('d', this.pathGenerator);
        
        this.parent.call(
            d3.zoom()
                .translateExtent([[-100,-100], [this.width+100, this.height+100]]) // Lets us see the outer points easily
                .on('zoom', event => this.mapGroup.attr('transform', event.transform))
        );
        
        // And the rest of the party
        this.populate()
    }
    
    /**
    * Create elements in the visualisation according to the data
    */  
    populate() {
        
        const tooltip = d3.select('#tooltip');
        
        // Plot all the points
        this.mapGroup.selectAll('circle').data(this.plotData, d => d.IncidentNumber).join('circle')
            .call(point => {
                let coords = d => this.projection([d.Longitude,d.Latitude]);
                point.attr('r', 1)
                    .attr('cx', d => coords(d)[0])
                    .attr('cy', d => coords(d)[1]);
            })
            .attr('fill', d => this.colourScale(this.colourValue(d)) )
            .style('display', d => this.filter(d) ? 'block' : 'none')
            .on('mousemove', (event, d) => {
            tooltip.style('display', 'block')
                .style('left', (event.pageX + 5) + 'px')   
                .style('top', (event.pageY + 5) + 'px')
                .html(`
                    <h2>${d.FinalDescription}</h2>
                    <p>${d.AnimalGroupParent}</p>
                    <p>${d.PropertyType}</p>
                    <p>${d.DateTimeOfCall.toDateString()} at ${d.DateTimeOfCall.toTimeString().split(' ')[0]}</p>
                `);
            })
            .on('mouseout', () => tooltip.style('display', 'none'))
            .on('animationEnd', event => d3.select(this).style('animation-play-state', 'paused'))
            .style('animation-play-state', 'paused');

    }
    
    /**
    * Hover interaction
    * @param {Object[]} cat - data items with the desired categories
    */  
    hover(cat) {
        if (cat) {
            this.mapGroup.selectAll('circle').data(cat, d => d.IncidentNumber).join(
                enter => enter, // No surprises
                update => update.attr('r', 5),
                exit => exit
            );
        } else {
            this.mapGroup.selectAll('circle').attr('r', 1);
        }
        
    }
     /**
     * Play the animation based on the supplied time function
     * WHat we're doing here is giving every data point the same animation but with a delay specified by the time function
     * In this way, they appear in order without us having to do any real work - thank you CSS for being an absolute bestie muchas gracias chica
     * @param {function} timeFunction - function that takes an item and returns the number defining its point in the time distribution
     */
    animate(timeFunction) {
        
        this.animChoice = 1 - this.animChoice; // So it's easier to switch between two different animation then try and re-play the same one, so this keeps track of which one to use
        
        const animationTimeScale = d3.scaleLinear()
            .domain(d3.extent(this.plotData, timeFunction))
            .range([0,4]); // Each circle is anmated for 4 seconds
        
        this.mapGroup.selectAll('circle').data(this.plotData, d => d.IncidentNumber).join('circle')
            .style('animation', d => `1s ease ${animationTimeScale(timeFunction(d))}s pop-in${this.animChoice}`);
        
    }
    
    /**
    * Update the object's attributes and refresh the visualisation
    * Changes the axes, scales, data getters, etc
    * @param {Object} new_attrs
    */
    update(new_attrs) {
        Object.keys(new_attrs).forEach(key => this[key] = new_attrs[key]);
        this.populate();
    };
}