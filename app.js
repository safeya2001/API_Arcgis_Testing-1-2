document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form1").addEventListener("submit", (e) => {
    e.preventDefault();
  });

  // Load the Map and MapView modules
  require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/Graphic",
    "esri/symbols/SimpleFillSymbol"
  ], (Map, MapView, FeatureLayer, Graphic, SimpleFillSymbol) => {
    const featureLayer = new FeatureLayer({
      url: "https://services.gis.ca.gov/arcgis/rest/services/Boundaries/CA_Counties/FeatureServer/0",
      popupTemplate: {
        title: "CA counties",
        content: "OBJECTID: {OBJECTID} <br> Population: {Population}<br>AREA_ID: {AREA_ID}<br>DETAIL_CTY: {DETAIL_CTY}",
      },
    });

    const featureLayer2 = new FeatureLayer({
      url: "https://services.gis.ca.gov/arcgis/rest/services/Boundaries/CA_National_Parks/MapServer/0",
    });

    const myMap = new Map({
      basemap: "streets-navigation-vector",
    });

    myMap.addMany([featureLayer, featureLayer2]);

    const view = new MapView({
      map: myMap,
      container: "viewDiv",
      center: [-100, 40],
      zoom: 4,
    });

    view.whenLayerView(featureLayer).then((layerView) => {
      const fields = layerView.layer.fields;
      const fieldSelect = document.getElementById("fieldSelect");

      fields.forEach((field) => {
        const option = document.createElement("option");
        option.value = field.name;
        option.textContent = field.name;
        option.dataset.esriType = field.type;
        fieldSelect.append(option);
      });

      document.getElementById("form1").addEventListener("submit", (e) => {
        const inputValue = document.getElementById("filterInput").value;
        const selectedIndex = fieldSelect.selectedIndex;
        const selectedField = fields[selectedIndex - 1];

        if (!inputValue) {
          featureLayer.definitionExpression = "1=1";
          return;
        }

        if (["oid", "integer", "double"].includes(selectedField.type)) {
          featureLayer.definitionExpression = `${selectedField.name} = ${inputValue}`;
        } else if (selectedField.type === "string") {
          featureLayer.definitionExpression = `LOWER(${selectedField.name}) like '${inputValue.toLowerCase()}%'`;
        }
      });

      fieldSelect.addEventListener("change", () => {
        document.getElementById("filterInput").value = "";
      });

      document.getElementById("filterInput").addEventListener("input", (e) => {
        const dataList = document.getElementById("myDataList");
        if (e.currentTarget.value.length < 3) {
          dataList.replaceChildren();
          return;
        }

        const selectedIndex = fieldSelect.selectedIndex;
        const selectedField = fields[selectedIndex - 1];
        const query = featureLayer.createQuery();
        query.outFields = ["*"];
        query.where = "1=1";
        query.returnDistinct = true;

        featureLayer.queryFeatures(query).then((response) => {
          const attributes = response.features.map(feature => feature.attributes);
          const dataListValues = attributes.map(attribute => attribute[selectedField.name]);

          dataList.replaceChildren();
          dataListValues.forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            dataList.append(option);
          });
        });
      });

      const fieldsToShow = ["AREA_ID", "POLYGON_NM", "Population"];
      let query = featureLayer.createQuery();
      query.where = "POLYGON_NM like 'S%'";
      query.outFields = ["*"];
      query.returnGeometry = true;

      featureLayer.queryFeatures(query).then((response) => {
        const features = response.features;
        const attributes = features.map(feature => feature.attributes);
        const geometries = features.map(feature => feature.geometry);
        const featuresTable = document.getElementById("features-table");
        const featuresTableHeader = featuresTable.querySelector("thead");
        const featuresTableBody = featuresTable.querySelector("tbody");

        const headerTr = document.createElement("tr");
        featuresTableHeader.append(headerTr);

        fieldsToShow.forEach((field) => {
          const th = document.createElement("th");
          th.textContent = field;
          headerTr.append(th);
        });

        attributes.forEach((attribute, index) => {
          const tr = document.createElement("tr");
          tr.id = index;
          fieldsToShow.forEach((field) => {
            const td = document.createElement("td");
            td.textContent = attribute[field];
            tr.append(td);
          });
          featuresTableBody.append(tr);
          tr.addEventListener("click", (e) => {
            view.graphics.removeAll();
            const index = e.currentTarget.id;
            const geometry = geometries[index];
            console.log(geometry);

            const symbol = new SimpleFillSymbol({
              color: [51, 51, 204, 0.9],
              style: "solid",
              outline: {
                color: "white",
                width: 1,
              },
            });
            const graphic = new Graphic({
              geometry,
              symbol,
            });
            view.graphics.add(graphic);
            view.goTo(geometry);
          });
        });
      });

      // Add pie chart for population data
      const query3 = featureLayer.createQuery();
      query3.groupByFieldsForStatistics = ["DETAIL_CTY"];
      query3.outStatistics = [
        {
          statisticType: "sum",
          onStatisticField: "Population",
          outStatisticFieldName: "TOTALSUM",
        },
      ];
      query3.outFields = ["DETAIL_CTY", "TOTALSUM"];
      query3.where = "DETAIL_CTY is not null and DETAIL_CTY <> ''";

      featureLayer.queryFeatures(query3).then((response) => {
        const features = response.features;
        const attributes = features.map(feature => feature.attributes);
        const cities = attributes.map(attribute => attribute["DETAIL_CTY"]);
        const populations = attributes.map(attribute => attribute["TOTALSUM"]);

        const pieChart = echarts.init(document.getElementById("pieChart"));

        pieChart.setOption({
          title: {
            text: 'Population Distribution',
            subtext: 'by City',
            left: 'center'
          },
          tooltip: {
            trigger: 'item'
          },
          legend: {
            orient: 'vertical',
            left: 'left'
          },
          series: [
            {
              name: 'Population',
              type: 'pie',
              radius: '50%',
              data: cities.map((city, index) => ({
                value: populations[index],
                name: city,
              })),
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
              }
            }
          ]
        });
      });

      const query2 = featureLayer2.createQuery();
      query2.groupByFieldsForStatistics = ["UNIT_TYPE"];
      query2.outStatistics = [
        {
          statisticType: "count",
          onStatisticField: "UNIT_TYPE",
          outStatisticFieldName: "TOTALCOUNT",
        },
      ];
      query2.outFields = ["UNIT_TYPE", "TOTALCOUNT"];
      query2.where = "UNIT_TYPE is not null and UNIT_TYPE <> ''";

      featureLayer2.queryFeatures(query2).then(function (response) {
        const features = response.features.sort((a, b) => b.attributes["TOTALCOUNT"] - a.attributes["TOTALCOUNT"]);
        const attributes = features.map(feature => feature.attributes);
        const types = attributes.map(attribute => attribute["UNIT_TYPE"]);
        const values = attributes.map(attribute => attribute["TOTALCOUNT"]);

        const myBarChart = echarts.init(document.getElementById("someChart"));

        myBarChart.setOption({
          title: {
            text: "ECharts Getting Started Example",
          },
          tooltip: {
            show: true,
            trigger: "item",
          },
          xAxis: {
            data: types,
          },
          yAxis: {
            type: "value",
          },
          series: [
            {
              data: values,
              type: "bar",
            },
          ],
        });
      });
    });
  });
});
