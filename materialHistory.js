// Function to fetch material history from Firestore
async function fetchMaterialHistoryFromDB(materialName) {
    try {
        const docRef = db.collection('history').doc(materialName);
        console.log(`Fetching history for material: ${materialName} retrieved from database`);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            cachedMaterialHistory[materialName] = data; // Cache the data
            return data;
        } else {
            console.error(`No document found for material: ${materialName}`);
            return null;
        }
    } catch (error) {
        console.error('Error fetching document: ', error);
        return null;
    }
}

// Function to handle dropdown change
async function handleMaterialSelection() {
    const selectedMaterial = document.getElementById("historyMaterialSelect").value;

    if (!selectedMaterial) {
        console.log('No material selected.');
        return;
    }
    // Check if the material is in the cache
    if (cachedMaterialHistory[selectedMaterial]) {
        console.log('Material found in cache:', cachedMaterialHistory[selectedMaterial]);
        displayMaterialHistory(cachedMaterialHistory[selectedMaterial]);
    } else {
        // Fetch from Firestore and update the cache
        const history = await fetchMaterialHistoryFromDB(selectedMaterial);
        if (history) {
            console.log('Material fetched from DB:', history);
            displayMaterialHistory(history);
        }
    }
}

function displayMaterialHistory(history) {
    console.log('Displaying material history:', history);

    // Convert history object to an array of [timestamp, entry] pairs
    const historyArray = Object.entries(history).sort((a, b) => {
        const dateComparison = new Date(a[1].datetime) - new Date(b[1].datetime);
    
        if (dateComparison !== 0) {
            // If datetime values are different, return the result of their comparison
            return dateComparison;
        } else {
            // If datetime values are the same, compare by expiryDate
            return new Date(a[1].expiryDate) - new Date(b[1].expiryDate);
        }
    });

    // Sort the array by date (earlier dates first)
    historyArray.sort((a, b) => new Date(a[0]) - new Date(b[0]));

    // Example of displaying in a table
    const historyTable = document.getElementById('materialHistoryTable');
    const tbody = historyTable.querySelector('tbody');
    tbody.innerHTML = ''; // Clear previous content

    for (const [timestamp, entry] of historyArray) {
        const row = document.createElement('tr');

        const dateCell = document.createElement('td');
        dateCell.textContent = formatDateTime(entry.datetime);

        const batchNumberCell = document.createElement('td');  // New Batch Number Cell
        batchNumberCell.textContent = entry.batchNo || 'N/A';  // Use 'N/A' if batch number is not available

        const expiryDateCell = document.createElement('td');    // New Expiry Date Cell
        expiryDateCell.textContent = entry.expiryDate ? formatDateTime(entry.expiryDate, false) : 'N/A'; // Use 'N/A' if expiry date is not available

        const inCell = document.createElement('td');
        inCell.textContent = Math.round(entry.in*1000)/1000;

        const outCell = document.createElement('td');
        outCell.textContent = Math.round(entry.out*1000)/1000;

        const balanceCell = document.createElement('td');
        balanceCell.textContent = Math.round(entry.balance*1000)/1000;

        row.appendChild(dateCell);
        row.appendChild(batchNumberCell);  
        row.appendChild(expiryDateCell);   
        row.appendChild(inCell);
        row.appendChild(outCell);
        row.appendChild(balanceCell);

        tbody.appendChild(row);
    }
}





