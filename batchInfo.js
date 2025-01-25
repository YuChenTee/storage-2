async function populateBatchInfoTable() {
    const materialName = document.getElementById('batchInfoMaterialSelect').value;
    const tableBody = document.getElementById('batchInfoTable').querySelector('tbody');

    // Clear existing rows
    tableBody.innerHTML = '';

    // Check if the history is in the cache
    let history = cachedMaterialHistory[materialName];
    if (!history) {
        // If not in cache, fetch from the database
        history = await fetchMaterialHistoryFromDB(materialName);
        if (!history) {
            console.error(`No history found for ${materialName}.`);
            return;
        }
        // Cache the fetched history
        cachedMaterialHistory[materialName] = history;
    }

    // Calculate the batch amounts
    let batchAmounts = {};
    Object.entries(history).forEach(([key, entry]) => {
        const batchNo = entry.batchNo;
        const expiryDate = entry.expiryDate;
        if (!batchAmounts[batchNo]) {
            batchAmounts[batchNo] = {
                expiryDate: expiryDate,
                amount: 0
            };
        }
        batchAmounts[batchNo].amount += entry.in - entry.out;
    });

    // Populate the table
    Object.entries(batchAmounts).forEach(([batchNo, details]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${batchNo}</td>
            <td>${formatDateTime(details.expiryDate, false)}</td>
            <td>${Math.round(details.amount*1000)/1000}</td>
        `;
        tableBody.appendChild(row);
    });
}
