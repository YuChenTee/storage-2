// Function to populate the material list and thresholds
function populateMaterialList() {
    const materialListContent = document.getElementById('materialListContent');
    materialListContent.innerHTML = ''; // Clear any previous content

    // Get all the material keys from cachedMaterials
    const sortedMaterials = Object.keys(cachedMaterials).sort(); // Sort the materials alphabetically

    sortedMaterials.forEach(materialKey => {
        const amount = cachedMaterials[materialKey];
        const threshold = cachedThresholds[materialKey] || null; // Get the threshold for the material
        
        // Split materialKey into code, name, and unit
        const firstSpaceIndex = materialKey.indexOf(' ');
        const lastParenIndex = materialKey.lastIndexOf('(');
        
        let code = '';
        let name = '';
        let unit = '';

        if (firstSpaceIndex !== -1 && lastParenIndex !== -1) {
            code = materialKey.substring(0, firstSpaceIndex); // Extract the material code
            name = materialKey.substring(firstSpaceIndex + 1, lastParenIndex).trim(); // Extract the material name
            unit = materialKey.substring(lastParenIndex + 1, materialKey.length - 1); // Extract the unit inside parentheses
        } else {
            // If no valid format, assign default values
            name = materialKey;
            unit = 'N/A';
        }

        // Create a new table row
        const row = document.createElement('tr');
        
        // Create cells for code, material name, amount, unit, threshold, and status
        const codeCell = document.createElement('td');
        codeCell.textContent = code || 'N/A';

        const nameCell = document.createElement('td');
        nameCell.textContent = name;
        nameCell.classList.add('clickable');
        nameCell.onclick = () => viewBatchInfo(materialKey); // Pass the material key to the function

        const unitCell = document.createElement('td');
        unitCell.textContent = unit;

        const amountCell = document.createElement('td');
        amountCell.textContent = Math.round(amount*1000)/1000;

        const thresholdCell = document.createElement('td');
        thresholdCell.textContent = threshold !== null ? threshold : 'N/A';

        const statusCell = document.createElement('td');
        let statusText = '';
        
        if (threshold !== null) {
            if (amount < threshold) {
                // Amount is less than the threshold
                statusText = `<span style="color: red; font-weight:bold;">Below Threshold</span>`;
            } else {
                // Amount is equal to or greater than the threshold
                statusText = `<span style="color: green; font-weight:bold;">OK</span>`;
            }
        } else {
            // No threshold set for this material
            statusText = `<span style="color: gray; font-weight:bold;">No Threshold Set</span>`;
        }
        
        statusCell.innerHTML = statusText;

        // Append cells to the row
        row.appendChild(codeCell);
        row.appendChild(nameCell);
        row.appendChild(amountCell);
        row.appendChild(unitCell); 
        row.appendChild(thresholdCell);
        row.appendChild(statusCell);

        // Append the row to the table body
        materialListContent.appendChild(row);
    });
}

//shortcut to view batch info of a selected material
function viewBatchInfo(material){
    $('#batchInfoMaterialSelect').val(material).trigger('change');
    showSection("batchInfo");
}
