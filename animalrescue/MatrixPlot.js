class MatrixPlot {
    
    /**
    * Constructor for matrixplot view
    * @param {D3 selection} _parent 
    * @param {Object} _data
    * @param {String} _rowCategoryLabel
    * @param {Map} _categoryNameMap
    * @param {function} _setTwoCategories
    * @param {String} [_title]
    * @param {string[]} [_selectedCategories]
    */
    constructor(_parent, _data, _margin, _rowCategoryLabel, _categoryNameMap, _setTwoCategories, _title="Calls by animal and", _selectedCategories = [null,null]) {
        this.parent = _parent;
        this.data = _data;
        this.margin = _margin;
        this.rowCategoryLabel = _rowCategoryLabel;
        this.colCategoryLabel = 'Origin';
        this.categoryNameMap = _categoryNameMap;
        this.setTwoCategories = _setTwoCategories;
        this.title = _title;
        this.selectedCategories = _selectedCategories;
        

        // Set up the html
        this.header = this.parent.append('div').attr('id', 'matrix-header');
        this.titleText = this.header.append('h2').attr('class', 'view-title').text(this.title);
        
        this.categorySelector = this.header.append('select'); // Dropdown for the available options
        this.categorySelector.on('change', event => {this.colCategoryLabel = event.target.value; this.populate()});
        this.setOptions();
        
        this.header.append('br');
        this.header.append('p').text('Colour cells by');
        this.colourType = 'Quantity';
        this.colouringSelector = this.header.append('select').on('change', event => {this.colourType = event.target.value; this.populate()});
        this.colouringSelector.selectAll('options').data(['Quantity', 'Deviation from statistical independence']).join('option')
            .text(d=>d.toLowerCase())
            .attr('value',d=>d);
            
        this.legendDiv = this.header.append('div').style('display', 'flex').style('justify-content', 'center');
        this.leftStop = this.legendDiv.append('p').attr('class', 'legend-label');
        this.legend = this.legendDiv.append('div').attr('id', 'matrix-legend');
        this.rightStop = this.legendDiv.append('p').attr('class', 'legend-label');
        
        this.matrixSVG = this.parent.append('svg').attr('id', 'matrix-svg');
        
        
        this.textWidth = 100;
        this.width  = +this.matrixSVG.node().getBoundingClientRect().width; // Because widths are computed, not set
        this.height = +this.matrixSVG.node().getBoundingClientRect().height;
        this.innerWidth  = this.width - this.margin.left - this.margin.right;
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;
        
        this.matrixWidth = this.innerWidth - this.textWidth;
        this.matrixHeight = this.innerHeight - this.textWidth;
        
        //Set up groups
        this.chart = this.matrixSVG.append('g').attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        this.matrix = this.chart.append('g').attr('transform', `translate(${this.textWidth},${this.textWidth})`);
        
        this.matrixSVG.call(
            d3.zoom()
                .on('zoom', event => this.chart.attr('transform', event.transform))
        );
        
        this.populate();
    }
    
    /**
    * Check if a given cell is selected, and therefore should have a red border
    * @param {Array} cell - array of [ {val: String, joinKey: String}, {val: String, joinKey: String}, Int ]
    */
    isSelected(cell) {
        let row = cell[0].val;
        let col = cell[1].val;
        
        let v;
        
        if (this.selectedCategories[0]) { // We have a row selected
            if (this.selectedCategories[1]) { // and a column
                v= (row === this.selectedCategories[0]) && (col === this.selectedCategories[1]);
            } else {
                v= row===this.selectedCategories[0];
            }
        } else { // No categories selected
            v = false;
        }
        return v
    }
    
    /**
    * Update the options available in the dropdown
    */
    setOptions() {
        this.categorySelector.selectAll('option').data(this.categoryNameMap.keys()).join('option')
            .attr('value', d=>d)
            .text(d => d.toLowerCase());
        
        this.categorySelector.select(`option[value=${this.colCategoryLabel}]`).attr('selected', 'selected'); //sets the selected option
    }
    
    /**
    * Return the possible values of a categorical attribute across data points, sorted
    * @param {function} categoryAccessor - given a data item, return the value of the desired attribute
    */
    getSortedCategoryValues(categoryAccessor) {
        const valueQuantities = d3.rollup(this.data, v => v.length, categoryAccessor);
        const catKeys = Array.from(valueQuantities.keys());
        catKeys.sort((a,b) => valueQuantities.get(b) - valueQuantities.get(a));
        return catKeys;
    }
    
    /**
    * Create elements in the visualisation according to the data
    */    
    populate() {
        const tooltip = d3.select('#tooltip');
        const rowCatAccessor = d => d[this.categoryNameMap.get(this.rowCategoryLabel)];
        const colCatAccessor = d => d[this.categoryNameMap.get(this.colCategoryLabel)];
        
        let rowLabels = this.getSortedCategoryValues(rowCatAccessor);
        let colLabels = this.getSortedCategoryValues(colCatAccessor);
        
        const value = d3.rollup(this.data, v => v.length, rowCatAccessor, colCatAccessor); // returns 2-nested map
        const rowSums = d3.rollup(this.data, v => v.length, rowCatAccessor);
        const colSums = d3.rollup(this.data, v => v.length, colCatAccessor);
        
        // The deviation from expected distribution stuff
        const chiSquaredValue = new Map();
        const expectedNumber = new Map();
        rowLabels.forEach(rowLabel => colLabels.forEach(colLabel => {
            const observed = value.get(rowLabel).has(colLabel) ? value.get(rowLabel).get(colLabel) : 0;
            const expected = rowSums.get(rowLabel) * colSums.get(colLabel) / this.data.length;
            expectedNumber.set(rowLabel + ' ' + colLabel, expected);
            chiSquaredValue.set(rowLabel + ' ' + colLabel, (observed > expected ? 1 : -1) * (observed-expected)*(observed-expected)/expected);
        }));
        
        
        let scale;
        if (this.colourType != 'Quantity') {
            const max = d3.max( Array.from(chiSquaredValue.values()) );
            const min = -1 * d3.least( Array.from(chiSquaredValue.values()) );
            const extent = max > min ? max : min;
            scale = d3.scaleSqrt()
                .domain([-1*extent, extent])
                .range([0,1]);
            
            this.leftStop.text('Less');
            this.rightStop.text('More than expected');
            this.legend.style('background', `linear-gradient(0.25turn, ${d3.interpolatePuOr(0)}, ${d3.interpolatePuOr(0.5)}, ${d3.interpolatePuOr(1)})`)
        } else {
            // We'll have to get the max value by hand as d3 doesn't do well on it
            const maxVal = d3.max( Array.from(value.values()).map(map => d3.max(map.values())) );
            scale = d3.scaleSqrt()
                .domain([0,maxVal])
                .range([0,1]);
            
            this.leftStop.text(0);
            this.rightStop.text(maxVal + ' calls');
            this.legend.style('background', `linear-gradient(0.25turn, ${d3.interpolateCividis(0)}, ${d3.interpolateCividis(0.5)}, ${d3.interpolateCividis(1)})`)
        }
        
        
        
        // Give the labels a joinKey
        rowLabels.forEach( (label, i, array) => array[i] = {val: label, joinKey: label+this.rowCategoryLabel});
        colLabels.forEach( (label, i, array) => array[i] = {val: label, joinKey: label+this.colCategoryLabel});
        
        const cellHeight = this.matrixHeight / rowLabels.length;
        const cellWidth = this.matrixWidth / colLabels.length;
        
        const maxFontSize = 16;        
        const rowFontSize = Math.min(cellHeight * 0.7, maxFontSize);
        const colFontSize = Math.min(cellWidth/2, maxFontSize);
        const borderWidth = 0.75;
        
        // OK let's actually build the table now
        this.matrix.selectAll('g').data(rowLabels, d => d.joinKey).join('g')
            .selectAll('r').data((d,i) => colLabels.map(e => [d,e,i]), f => [f[0].joinKey, f[1].joinKey]).join('rect') // So our data is passed down to the next layer
                .attr('width', cellWidth - borderWidth)
                .attr('height', cellHeight - borderWidth)
                .attr('x', (d,i) => i * cellWidth + borderWidth/2)
                .attr('y', f => f[2] * cellHeight + borderWidth/2)
                .style('stroke', f => this.isSelected(f) ? 'red' : (this.colourType === 'Quantity' ? '#f0f0f0' : 'var(--text-colour)'))
                .style('stroke-width', f => this.isSelected(f) ? `${borderWidth*2}px` : `${borderWidth}px`)
                .attr('fill', f => {
                    let v;
                    if (this.colourType != 'Quantity') {
                        v = chiSquaredValue.get(f[0].val+' '+f[1].val);
                    } else {
                        v = value.get(f[0].val).has(f[1].val) ? value.get(f[0].val).get(f[1].val) : 0;
                    }
                    v = scale(v);
                    return this.colourType != 'Quantity' ? d3.interpolatePuOr(v) : d3.interpolateCividis(v);
                })
                .on('click', (event, f, j) =>  this.setTwoCategories(f[0].val, f[1].val, colCatAccessor))
                .on('mousemove', (event, f) => {
                    let v = value.get(f[0].val).has(f[1].val) ? value.get(f[0].val).get(f[1].val) : 0;
                    tooltip.style('display', 'block')
                        .style('left', (event.pageX + 5) + 'px')   
                        .style('top', (event.pageY + 5) + 'px')
                        .html( `<p>${this.rowCategoryLabel}: ${f[0].val}, ${this.colCategoryLabel}: ${f[1].val}</p><p>${v} ${v === 1 ? 'call' : 'calls'}${this.colourType != 'Quantity' ? ', expected ' + expectedNumber.get(f[0].val+' '+f[1].val).toFixed(2) : ''}</p>`);

                })
                .on('mouseout', () => tooltip.style('display', 'none'));
                
        //And the labels
        this.chart.selectAll('text.col-label').data(colLabels, d => d.joinKey).join('text')
            .attr('class', 'col-label')
            .text(d => d.val)
            .attr('x', (d,i) => this.textWidth + i * cellWidth + cellWidth/2)
            .attr('y', this.textWidth)
            .attr('font-size', colFontSize)
            .style('transform-origin', (d,i) => `${this.textWidth + i * cellWidth + cellWidth / 2}px ${this.textWidth - colFontSize/2}px`); // El dolor infinito
            
        this.chart.selectAll('text.row-label').data(rowLabels, d => d.joinKey).join('text')
            .attr('class', 'row-label')
            .text(d=> d.val)
            .attr('x', this.textWidth - 5)
            .attr('font-size', rowFontSize)
            .attr('y', (d,i) => this.textWidth + i*cellHeight + cellHeight/2 + 2);
        
    }
    
    /**
    * Update the object's attributes and refresh the visualisation
    * Changes the axes, scales, data getters, etc
    * @param {Object} new_attrs
    */
    update(new_attrs) {
        Object.keys(new_attrs).forEach(key => this[key] = new_attrs[key]);
        this.titleText.text(this.title);
        this.populate();
    };
}