import OsGridRef, { LatLon, Dms } from 'https://cdn.jsdelivr.net/npm/geodesy@2/osgridref.js';
// State
let data, colourScale, keyFrequencies, colourValue, map, barLegend, stackedArea, timeKeys, matrixPlot;
let stackDType = 'Quantity';
let stackFilter = d => true;
let categoryAttribute = 'AnimalGroupParent';
let selectedCategory = null;
let secondaryCategory = null;
let timeFunction = d => d.CalYear;
let animationTimeFunction = d => d.DateTimeOfCall.getTime();


// Utilities
/**
* Converts DD/MM/YYYY HH:MM to MM/DD/YYYY HH:MM because javascript was made by Yankies
* @param {String} dateString
*/
const reformatDate = dateString => {
    let dayTime = dateString.split(" ");
    let dmy = dayTime[0].split('/');
    let mdy = [dmy[1], dmy[0], dmy[2]].join('/');
    return mdy.concat(" ", dayTime[1]);
};

const categoricalNameMap = new Map([ // Display name -> Attribute name
    ['Animal', 'AnimalGroupParent'],
    ['Pump count', 'PumpCount'],
    ['Hours taken','PumpHoursTotal'],
    ["Origin", 'OriginofCall'],
    ["Location", 'PropertyCategory'],
]);

/**
* Given a categorical attribute of the data, return a d3 colourscale using it and our fancy colourpalette
* @param {String} cat
* @param {Object} data
*/
const categoryToColourScale = (cat, data) => {
        
    // First step, get the keys sorted in descending order of frequency
    keyFrequencies = d3.rollup(data, v => v.length, d => d[cat]);
    let keys = Array.from(new Set(data.map(d => d[cat])));
    keys.sort((a,b) => keyFrequencies.get(b) - keyFrequencies.get(a))
    
    const palette = new Palette(keys.length);
    
    const scale = d3.scaleOrdinal()
        .domain(keys)
        .range(palette.palette);
    
    return scale;
}

/**
* Returns number of calls in each category over time
* @param {string} cat - the actual categorical attribute
* @param {function} timeFunction - a function that takes an instance and returns a time value for it, guaranteed to be an int
* @param {Object[]} data
*/
const categorySummariesByTime = (cat, timeFunction, data) => {
    //First step: group according to category
    let formattedData = d3.groups(data, d => d[cat])
        .map(group => [group[0], d3.rollup(group[1], v => v.length, timeFunction)]); // Second: reduce and count by timeFunction
    return formattedData; // Returns [Category, Map(TimeInterval -> Count)]
}

/**
* Takes output from categorySummariesByTime and returns the data type used for the stacked area graph
* @param {Object} formattedData
* @param {function} [tf]
*/
function stackCategoryTimeSummaries(formattedData, tf=timeFunction) {
        
    // First step is to get all the timeKeys - one for each time interval considered
    timeKeys = Array.from(d3.rollup(data, v => v.length, tf).keys());
    timeKeys.sort((a,b) => a-b); // I hate javascript so much
    // And category keys
    const catKeys = Array.from(new Set(formattedData.map(group => group[0])));
    //Next is to transform the data so its of the form d3.stack can use
    const stackable = timeKeys.map(
        tk => {
            let tkObj = {time: tk};
            formattedData.forEach(group => {
                tkObj[group[0]] = group[1].has(tk) ? group[1].get(tk) : 0; // Not all categories will have calls in a given time interval
            });
            return tkObj;
        }
    );
    
    let stack = d3.stack().keys(catKeys);
    stack = stack(stackable);
    stack.forEach(d => d.joinKey = d.key + categoryAttribute); // Because the keys sometimes repeat acros categories
    return stack;
}

/**
* Generates data for the stack view
* @param {function} [tf]
*/
function getStackData(tf = timeFunction) {
    const filteredData = stackCategoryTimeSummaries(categorySummariesByTime(categoryAttribute, tf, data.filter(stackFilter)), tf);
    // Now we check for proportions
    if (stackDType === 'Proportion (%)'){
        const amountMap = d3.rollup(data, v => v.length, tf);
        let tKeys = Array.from(amountMap.keys());
        tKeys.sort((a,b) => a-b);
        
        const fullAmounts = tKeys.map(tk => amountMap.get(tk));
        
        fullAmounts.forEach((d, i) => filteredData.forEach(row => row[i].forEach((val, j, col) => col[j] = 100*val/d) ));
    }
    return filteredData;
}


// Event listeners
/**
* Changes state to match the new time distribution, updating everything applicable
* @param {String} timeString
*/
const changeTimeFunction = timeString => {
    let stackXLabel;
    switch (timeString) {
        case 'year':
            timeFunction = d => d.DateTimeOfCall.getMonth(); // for the stack
            animationTimeFunction = d => d.WrappedYearTime;
            stackXLabel = 'Month';
            
            break;
        
        case 'week':
            timeFunction = d => d.DateTimeOfCall.getDay(); // for the stack
            animationTimeFunction = d => d.WrappedWeekTime;
            stackXLabel = 'Day';
            break;
        
        case 'day':
            timeFunction = d => d.DateTimeOfCall.getHours(); // for the stack
            animationTimeFunction = d => d.WrappedDayTime;
            stackXLabel = 'Hour';
            break;
        
        default:
            timeFunction = d => d.CalYear; // for the stack
            animationTimeFunction = d => d.DateTimeOfCall.getTime();
            stackXLabel = 'Year';
    }
    stackedArea.update({
        data: getStackData(timeFunction),
        xLabel: stackXLabel,
        xRange: d3.extent(data, timeFunction)
    });
    
}

/**
* Trigger for the map anmation
*/
const animateMap = () => map.animate(animationTimeFunction);

/**
* Changes the y-axis display type for the stacked area view
* @param {String} dType
*/
const changeStackDisplayType = dType => {
    stackDType = dType;
    stackedArea.update({
        data: getStackData(),
        yLabel: stackDType
    });
}

/**
* Changes the main category used for grouping data, updating everything
* @param {String} categoryName
*/
const changeCategoryType = categoryName => {
    // A new category type has been selected
    // Clear state
    selectedCategory = null;
    stackFilter = d=>true;
    timeKeys = null;
    
    categoryAttribute = categoricalNameMap.get(categoryName);
    // Get new colourScale
    colourScale = categoryToColourScale(categoryAttribute, data);
    colourValue = d => d[categoryAttribute];
    // Update all views to match
    map.update({
        colourScale: colourScale,
        colourValue: colourValue,
        filter: stackFilter,
    });
    
    barLegend.update({
        colourScale: colourScale,
        colourValue: colourValue,
        categoryList: categoricalNameMap.keys(),
        selectedCategoryType: categoryName,
        selectedCategory: selectedCategory,
        data: colourScale.domain().map(c => [c, keyFrequencies.get(c), categoryName]), // Why the name? helps with keying for the join
        titleText: "Calls by "+categoryName.toLowerCase()+" value"
    });
    
    stackedArea.update({
        colourScale: colourScale, // Value accesor doesn't change
        data: getStackData(),
        title: "Number of calls over time by "+categoryName.toLowerCase()+" and"
    });
    
    matrixPlot.update({rowCategoryLabel: categoryName, title: `Calls by ${categoryName.toLowerCase()} and`});
}

/**
* Changes the selected category value for all of the views, filtering datapoints to just those with that value for the categoryAttribute
* @param {String} cat
*/
const selectCategory = cat => {
    
    if (cat === selectedCategory) {
        cat = null;
        stackFilter = d=>true;
    } else {
        stackFilter = d=> d[categoryAttribute]===cat;
    }
    selectedCategory = cat;
    map.update({filter: stackFilter});
    barLegend.update({selectedCategory: selectedCategory});
    stackedArea.update({data: getStackData()});
    matrixPlot.update({selectedCategories: [cat, null]});
}

/**
* Does tbe above, but with a secondary filter accessed via the matrix view
* @param {String} dType
*/
const selectTwoCategories = (cat, dog, getDog) => {
    if ((cat === selectedCategory) && (secondaryCategory === dog)) {
        cat = null;
        dog = null; //  Gosh aren't I funny qué loco
        stackFilter = d=>true;
    } else {
        stackFilter = d => (d[categoryAttribute]===cat) && (getDog(d) === dog);
    }
    selectedCategory = cat;
    secondaryCategory = dog;
    map.update({filter: stackFilter});
    barLegend.update({selectedCategory: selectedCategory});
    stackedArea.update({data: getStackData()});
    matrixPlot.update({selectedCategories: [cat, dog]});
}

/**
* Previews category selection on the map and stackedArea view
* @param {String} cat
*/
const categoryHover = cat => {
    const hoverData = data.filter(d => d[categoryAttribute] === cat);
    map.hover(cat ? hoverData : null);
    stackedArea.hover(cat);
}

// Set up the initial visualisation

d3.select('body').append('div').attr('id', 'tooltip').style('display', 'none');
//Get the data
d3.csv('data.csv')
    .then(loadedData => {
        data = loadedData;
        let newCoords;
        let timeObj = new Date('2009-01-01'); // I don't even know man don't worry about it
        // The whole idea is that the time distribution mught be cyclical, so values like "year" might get wrapped around. This timeObj provides default values
        
        
        // OK so data preprocessing
        // Sometimes, we get null attributes or 'Redacted'. For the purposes of this app, we're just gonna deal with it.
        data.forEach(d => {
            d.IncidentNumber = d.IncidentNumber; //So this stops being an int in the dataset really quickly, which I just love
            d.DateTimeOfCall = new Date(reformatDate(d.DateTimeOfCall));
            d.CalYear = +d.CalYear;
            
            if (!+d.PumpCount || !+d.PumpHoursTotal) { // Unfortunately for 64 calls the pump count/hours/cost information is just gone, so they'll need to be dealt with
            
                d.PumpCount = "Not known";
                d.PumpHoursTotal = "Not known";
                d.HourlyNotionalCost = "Not known";
                d.IncidentNotionalCost = "Not known";
                
            } else { 
                d.PumpCount = +d.PumpCount;
                d.PumpHoursTotal = +d.PumpHoursTotal;
                d.HourlyNotionalCost = +d.HourlyNotionalCost;
                d.IncidentNotionalCost = +d.IncidentNotionalCost;
            }

            d.Easting_rounded = +d.Easting_rounded;
            d.Northing_rounded = +d.Northing_rounded;
            d.Easting = +d.Easting_m;
            d.Northing = +d.Northing_m;
            
            // More data cleaning
            if (isNaN(d.Easting)) {
                d.Easting = +d.Easting_rounded;
                d.Northing = +d.Northing_rounded;
            }
            if (d.FinalDescription === 'Redacted') {
                d.FinalDescription = d.SpecialServiceTypeCategory;
            }
            
            newCoords = OsGridRef.parse([d.Easting, d.Northing].join(',')).toLatLon();
            d.Latitude = newCoords._lat;
            d.Longitude = newCoords._lon;
            
            
            // Ok back to wrapping the time values for the animation
            // reset back to defaults
            timeObj.setMonth(0);
            timeObj.setDate(1);
            
            // Set up new time values for animation **for this data point**
            timeObj.setHours(d.DateTimeOfCall.getHours());
            timeObj.setMinutes(d.DateTimeOfCall.getMinutes());
            d.WrappedDayTime = timeObj.getTime();
            
            timeObj.setDate(d.DateTimeOfCall.getDay()+1);
            d.WrappedWeekTime = timeObj.getTime();
            
            timeObj.setMonth(d.DateTimeOfCall.getMonth());
            timeObj.setDate(d.DateTimeOfCall.getDate());
            d.WrappedYearTime = timeObj.getTime();
            
            
            // We're gonna try deleting attributes we don't use, and see if that makes the program faster
            delete d.FinYear;
            delete d.TypeOfIncident;
            delete d.SpecialServiceType;
            delete d.WardCode;
            delete d.Ward;
            delete d.BoroughCode;
            delete d.Borough;
            delete d.StnGroundName;
            delete d.UPRN;
            delete d.Street;
            delete d.USRN;
            delete d.PostcodeDistrict;
        });
        
        //We actually have to change out the cooridnates in a second pass
        // Is this good? No.
        // Does it work? Also no. 
        // // Will it do? Yes.
        // const latScale = d3.scaleLinear().range([51.29769404694598, 51.6883002291303]).domain(d3.extent(data, d => d.Northing));
        // const lonScale = d3.scaleLinear().range([-0.5597498278345971, 0.4663867445300716]).domain(d3.extent(data, d => d.Easting));
        // data.forEach(d => {
            // d.Latitude = latScale(d.Northing);
            // d.Longitude = lonScale(d.Easting);
        // });
        
        
        
        // Set up the control panel
        // Not worth putting in a separate file as it's not a view and won't really get updated
        const controlPanel = d3.select('#control-panel');
        
        // Options select
        controlPanel.select('#category-type-select')
            .on('change', event => changeCategoryType(event.target.value))
            .selectAll('option').data(categoricalNameMap.keys()).join('option')
                .attr('value', d=>d)
                .text(d => d);
        
        //Time function
        controlPanel.selectAll('input[type="radio"]').on('change', event => changeTimeFunction(event.target.value));
        
        // Set up some charts
        // get those colours
        colourScale = categoryToColourScale(categoryAttribute, data);
        colourValue = d => d.AnimalGroupParent;
        
        
        // OK, now we can set up the actual views!
        // First up, deal with the map
        d3.json('./londonBoroughs.json')
            .then(topoData => {
                const mapData = topojson.feature(topoData, topoData.objects.boroughs)
                map = new ScatterMap(d3.select('#map'), mapData, data, colourScale, colourValue);
                
                //Set up the play button
                d3.select('#play').on('click', event => animateMap());
            });
        
        //Next, barchart legend
        barLegend = new BarLegend(d3.select('#categorical-content'),
            colourScale.domain().map(c => [c, keyFrequencies.get(c), 'Animal']),
            d=>d[0],d=>d[1],
            colourScale,
            selectCategory,
            null,
            categoryHover);
        
        let stacked = getStackData();
        // Stacked area view
        stackedArea = new StackedArea(d3.select('#area-div'),
            stacked,
            {top: 10, left: 60, right: 30, bottom: 50},
            [2009, 2022],
            d => d.data.time,
            d => d[1],
            d => d[0],
            colourScale,
            d => d.key,
            selectCategory,
            changeStackDisplayType
        );
        
        // Finally, the matrix plot
        matrixPlot = new MatrixPlot(d3.select("#matrix-content"),
            data,
            {top: 0, left: 10, right: 20, bottom: 30},
            'Animal',
            categoricalNameMap,
            selectTwoCategories,
        );
        
    });
