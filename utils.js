function showSection(sectionId, link = null) {
    // Remove the active class from all links
    const navLinks = document.querySelectorAll('nav ul li a');
    // navLinks.forEach(link => link.classList.remove('active'));

    // Add the active class to the clicked link, if provided
    // if (link) {
    //     link.classList.add('active');
    // }

    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.style.display = 'none');

    // Show the selected section
    document.getElementById(sectionId).style.display = 'block';
}

// Function to show update messages
function showUpdateMessage(id, message, isError = false) {
    const messageDiv = document.getElementById(id);
    messageDiv.textContent = message;
    messageDiv.style.color = isError ? 'red' : 'green';
    messageDiv.style.display = 'block';
    // Hide the message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

function confirmAction(message, action) {
    const modal = document.getElementById('customConfirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmYesBtn = document.getElementById('confirmYesBtn');
    const confirmNoBtn = document.getElementById('confirmNoBtn');

    confirmMessage.innerHTML = message;

    modal.style.display = 'flex'; // Show the modal
    modal.style.justifyContent = 'center'; // Center horizontally
    modal.style.alignItems = 'center'; // Center vertically
    modal.style.zIndex = '10000'; // Set z-index to be above other elements

    // Handle Yes button click
    confirmYesBtn.onclick = function() {
        modal.style.display = 'none'; // Hide the modal
        action(); // Execute the action
    };

    // Handle No button click
    confirmNoBtn.onclick = function() {
        modal.style.display = 'none'; // Hide the modal
    };
}

// Function to sort the table
function sortTable(tableID, columnIndex, NumberColumnArray=[], DateColumnArray=[]) {
    const table = document.getElementById(tableID);
    const rows = Array.from(table.rows).slice(1); // Get all rows except the header
    const isNumberColumn = NumberColumnArray.includes(columnIndex); // Check if it's a numeric column
    const isDateColumn = DateColumnArray.includes(columnIndex); // Check if it's a datetime column

    let sortedRows = rows.sort((a, b) => {
        const aText = a.cells[columnIndex].textContent.trim();
        const bText = b.cells[columnIndex].textContent.trim();

        if (isNumberColumn) {
            return parseFloat(aText) - parseFloat(bText);
        } else if (isDateColumn) {
            // Convert custom format to Date objects and compare them
            const aDate = parseCustomDateTime(aText);
            const bDate = parseCustomDateTime(bText);
            return aDate - bDate;
        } else {
            return aText.localeCompare(bText);
        }
    });

    // Check if already sorted in ascending order, reverse to descending if so
    const isAscending = table.getAttribute("data-sort-asc") === columnIndex.toString();
    if (isAscending) {
        sortedRows.reverse();
        table.setAttribute("data-sort-asc", "");
    } else {
        table.setAttribute("data-sort-asc", columnIndex.toString());
    }

    // Append sorted rows back to the table
    sortedRows.forEach(row => table.tBodies[0].appendChild(row));
}

function formatDateTime(dateString, time = true) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    if (time===false) {
        return `${day}/${month}/${year}`;
    }
    else{
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }
}

// Helper function to parse custom date format
function parseCustomDateTime(dateTimeString) {
    const [datePart, timePart] = dateTimeString.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hours = 0, minutes = 0, seconds = 0] = timePart ? timePart.split(':').map(Number) : [];

    return new Date(year, month - 1, day, hours, minutes, seconds);
}

async function duplicateCollection(srcCollectionName, destCollectionName) {
    const batchSize = 500; // Firestore limits batch writes to 500
    const srcCollectionRef = db.collection(srcCollectionName);
    const destCollectionRef = db.collection(destCollectionName);

    try {
        // Get all documents from the source collection
        const snapshot = await srcCollectionRef.get();

        if (snapshot.empty) {
            console.log(`No documents found in collection: ${srcCollectionName}`);
            return;
        }

        let batch = db.batch();
        let writeCount = 0;

        snapshot.forEach(doc => {
            const docData = doc.data();
            const newDocRef = destCollectionRef.doc(doc.id); // Create a new document with the same ID
            batch.set(newDocRef, docData); // Copy data to the new document

            writeCount++;
            if (writeCount === batchSize) {
                batch.commit();
                console.log(`Committed a batch of ${batchSize} writes.`);
                batch = db.batch(); // Reset batch after commit
                writeCount = 0;
            }
        });

        if (writeCount > 0) {
            await batch.commit(); // Commit the remaining writes
            console.log(`Committed a batch of ${writeCount} writes.`);
        }

        console.log(`Successfully duplicated collection from ${srcCollectionName} to ${destCollectionName}`);
    } catch (error) {
        console.error('Error duplicating collection:', error);
    }
}

async function backupIfNeeded() {
    const backupMetadataRef = db.collection('backup_time').doc('backup_metadata');
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-T:]/g, '').slice(0, 8); // Format: YYYYMMDD

    try {
        const docSnapshot = await backupMetadataRef.get();
        let backupHistory = [];

        if (docSnapshot.exists) {
            backupHistory = docSnapshot.data().history || [];
        }

        // Check if the last backup is recent (e.g., within 24 hours)
        if (backupHistory.length > 0) {
            const lastBackupDate = new Date(backupHistory[backupHistory.length - 1].timestamp);
            if ((now - lastBackupDate) < 24 * 60 * 60 * 1000) {
                console.log('Recent backup exists. No action needed.');
                return;
            }
        }

        console.log('Running backup...');

        // Create timestamped backup names
        const collectionsToBackup = [
            'buffer', 'history', 'materials', 'numOfDays', 
            'orders', 'product_list', 'products', 'salesOrder', 'thresholds'
        ];

        for (const collection of collectionsToBackup) {
            const newBackupName = `${collection}_backup_${timestamp}`;
            await duplicateCollection(collection, newBackupName);
        }

        // Update backup history
        backupHistory.push({ timestamp: now.toISOString(), id: timestamp });

        // Keep only the last 3 backups
        if (backupHistory.length > 3) {
            const oldBackup = backupHistory.shift(); // Remove the oldest backup
            for (const collection of collectionsToBackup) {
                const oldBackupName = `${collection}_backup_${oldBackup.id}`;
                await deleteCollection(oldBackupName); // Ensure you have a delete function
            }
        }

        // Save updated history
        await backupMetadataRef.set({ history: backupHistory });

        console.log('Backup completed and history updated.');
    } catch (error) {
        console.error('Error handling backup:', error);
    }
}

// Helper function to delete an entire collection
async function deleteCollection(collectionName) {
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) return;

    const batchSize = 500;
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;

        if (count === batchSize) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    console.log(`Deleted old backup: ${collectionName}`);
}

// Optional: Close the modal if the user clicks outside of it
window.onclick = function(event) {
    const modal = document.getElementById('customConfirmModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};

async function downloadMaterialList() {
    try {
        const workbook = XLSX.utils.book_new();
        
        // Create a sheet for material list data
        const worksheetData = [
        ["Material Code", "Material Name", "Amount", "Unit", "Threshold", "Status"]
        ];

        // Get all the material keys from cachedMaterials
        const sortedMaterials = Object.keys(cachedMaterials).sort(); // Sort materials alphabetically

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
            name = materialKey;
            unit = 'N/A';
        }

        // Determine status based on threshold
        let status = 'No Threshold Set';
        if (threshold !== null) {
            status = amount < threshold ? 'Below Threshold' : 'OK';
        }

        // Add material data to the worksheet
        worksheetData.push([
            code || 'N/A',
            name || 'N/A',
            Math.round(amount * 1000) / 1000,
            unit || 'N/A',
            threshold !== null ? threshold : 'N/A',
            status
        ]);
        });

        // Convert the worksheet data to a sheet
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const sheetName = "Material List"; // Use a common name for the sheet
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Write workbook to binary array
        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });

        // Trigger download of the Excel file
        saveAs(blob, "Material_List.xlsx");
        console.log("✅ Material List downloaded successfully.");
    } catch (error) {
        console.error("❌ Error downloading material list:", error);
    }
}

// Function to download material history and batch info in the same worksheet
async function downloadMaterialHistoryAndBatchInfo() {
    try {
        const workbook = XLSX.utils.book_new();

        // Fetch all material history documents from Firestore
        const materialsSnapshot = await db.collection('history').get();
        
        if (materialsSnapshot.empty) {
            console.log("No materials found in the database.");
            return;
        }

        // Loop through all documents in the material history collection
        for (const doc of materialsSnapshot.docs) {
            const materialName = doc.id; // Material name is the document ID
            const history = doc.data(); // Get the material history data from the document
            
            // Prepare the material history worksheet data
            const historyWorksheetData = [
                ["Date", "Batch Number", "Expiry Date", "In", "Out", "Balance"] // Headers for history sheet
            ];

            // Convert history object to an array of [timestamp, entry] pairs and sort by datetime and expiryDate
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

            // Populate material history data
            historyArray.forEach(([timestamp, entry]) => {
                const inValue = parseFloat(entry.in) || 0;
                const outValue = parseFloat(entry.out) || 0;
                const balanceValue = parseFloat(entry.balance) || 0;

                historyWorksheetData.push([
                    formatDateTime(entry.datetime),
                    entry.batchNo || 'N/A',
                    entry.expiryDate ? formatDateTime(entry.expiryDate, false) : 'N/A',
                    Math.round(inValue * 1000) / 1000,
                    Math.round(outValue * 1000) / 1000,
                    Math.round(balanceValue * 1000) / 1000
                ]);
            });

            // Create the material history sheet
            const historyWorksheet = XLSX.utils.aoa_to_sheet(historyWorksheetData);

            // Add a blank row for spacing between history and batch info
            historyWorksheetData.push([]); // Empty row for spacing

            // Fetch batch info for the material and append it below the history
            const batchAmounts = await populateBatchInfoBatchData(historyArray);
            const batchInfoData = [
                ["Batch Number", "Expiry Date", "Amount"] // Headers for batch info
            ];

            // Populate batch info data
            Object.entries(batchAmounts).forEach(([batchNo, details]) => {
                batchInfoData.push([
                    batchNo,
                    formatDateTime(details.expiryDate, false),
                    Math.round(details.amount * 1000) / 1000
                ]);
            });

            // Append the batch info data to the worksheet
            historyWorksheetData.push(...batchInfoData);

            // Re-create the worksheet with the combined data (history + batch info)
            const combinedWorksheet = XLSX.utils.aoa_to_sheet(historyWorksheetData);

            // Ensure sheet name is within 31 characters (Excel limitation)
            const sheetName = materialName.length > 31 ? materialName.slice(0, 31) : materialName;
            const sanitizedSheetName = sheetName.replace(/[\\\/\*\?\:\[\]]/g, '_');  // Replace invalid characters

            // Append the worksheet to the workbook
            XLSX.utils.book_append_sheet(workbook, combinedWorksheet, sanitizedSheetName);
        }

        // Write workbook to binary array
        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });

        // Trigger download of the Excel file
        saveAs(blob, "Material_History_and_Batch_Info.xlsx");
        console.log("✅ Material history and batch info downloaded successfully.");
    } catch (error) {
        console.error("❌ Error downloading material history and batch info:", error);
    }
}

// Helper function to get batch amounts data (for batch info)
async function populateBatchInfoBatchData(history) {

    let batchAmounts = {};

    history.forEach(([key, entry]) => {
        const batchNo = entry.batchNo;
        const expiryDate = entry.expiryDate;
        
        if (!batchAmounts[batchNo]) {
            batchAmounts[batchNo] = {
                expiryDate: expiryDate,
                amount: 0
            };
        }
        
        // Ensure 'in' and 'out' are numeric and compute the amount
        const inValue = parseFloat(entry.in) || 0;
        const outValue = parseFloat(entry.out) || 0;
        
        batchAmounts[batchNo].amount += inValue - outValue;
    });

    return batchAmounts;
}

async function downloadSalesOrders() {
    try {
      const workbook = XLSX.utils.book_new();

      // If sales orders are not in cache, fetch from the database
      if (Object.keys(cachedSalesOrders).length === 0) {
        await fetchSalesOrdersFromDB();
      }

      // Create a worksheet with the sales orders data
      const salesOrdersWorksheetData = [
        ["Order ID", "Order Date", "Products", "Quantities", "Expected Delivery Date", "Status"] // Headers
      ];

      // Get the sorted sales order IDs
      const sortedOrderIDs = Object.keys(cachedSalesOrders).sort();

      // Populate sales order data
      sortedOrderIDs.forEach(orderID => {
        const order = cachedSalesOrders[orderID];

        let productNames = '';
        let quantities = '';

        // Handle multiple products in each order
        order.products.forEach(productEntry => {
            productNames += `${cachedProductList[productEntry.product]} \n`; // Product names with line break
            quantities += `${productEntry.quantity} \n`; // Quantities with line break
        });

        salesOrdersWorksheetData.push([
          orderID,
          formatDateTime(order.orderDate),
          productNames.trim(),
          quantities.trim(),
          order.expectedDeliveryDate ? formatDateTime(order.expectedDeliveryDate, false) : 'N/A',
          order.status || 'N/A'
        ]);
      });

      // Create the worksheet
      const salesOrdersWorksheet = XLSX.utils.aoa_to_sheet(salesOrdersWorksheetData);

      // Append the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, salesOrdersWorksheet, "Sales Orders");

      // Write workbook to binary array
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      // Trigger download of the Excel file
      saveAs(blob, "Sales_Orders.xlsx");
      console.log("✅ Sales Orders downloaded successfully.");
    } catch (error) {
      console.error("❌ Error downloading sales orders:", error);
    }
}

async function downloadPurchaseOrders() {
    try {
      const workbook = XLSX.utils.book_new();

      // If purchase orders are not in cache, fetch from the database
      if (Object.keys(cachedOrders).length === 0) {
        await fetchOrdersFromDB();
      }

      // Create a worksheet with the purchase order data
      const purchaseOrdersWorksheetData = [
        ["Order ID", "Order Date", "Material Key", "Ordered Quantity", "Expected Arrival Date", "Status"] // Headers
      ];

      // Get the sorted purchase order IDs
      const sortedOrderIDs = Object.keys(cachedOrders).sort();

      // Populate purchase order data
      sortedOrderIDs.forEach(orderID => {
        const order = cachedOrders[orderID];

        let materialKey = order.materialKey || 'N/A';
        let orderedQuantity = order.orderedQuantity || 0;
        let status = order.status || 'N/A';
        let expectedArrivalDate = order.expectedArrivalDate ? formatDateTime(order.expectedArrivalDate, false) : 'N/A';

        // Handle ordered quantity and status if partial received
        if (status.includes('Partial Received:')) {
          const partialReceivedAmount = parseFloat(status.split(' ')[2]);
          orderedQuantity -= partialReceivedAmount; // Adjust the quantity based on partial received
        }

        purchaseOrdersWorksheetData.push([
          orderID,
          formatDateTime(order.orderDate),
          materialKey,
          Math.round(orderedQuantity * 1000) / 1000, // Round to 3 decimal places
          expectedArrivalDate,
          status
        ]);
      });

      // Create the worksheet
      const purchaseOrdersWorksheet = XLSX.utils.aoa_to_sheet(purchaseOrdersWorksheetData);

      // Append the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, purchaseOrdersWorksheet, "Purchase Orders");

      // Write workbook to binary array
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      // Trigger download of the Excel file
      saveAs(blob, "Purchase_Orders.xlsx");
      console.log("✅ Purchase Orders downloaded successfully.");
    } catch (error) {
      console.error("❌ Error downloading purchase orders:", error);
    }
}

async function downloadProductDetails() {
    try {
      const workbook = XLSX.utils.book_new();

      // Fetch all products from the Firestore collection
      const productsSnapshot = await db.collection('products').get();
      
      if (productsSnapshot.empty) {
        console.log("No products found.");
        return;
      }

      // Loop through each product document
      productsSnapshot.forEach(doc => {
        const productId = doc.id;
        const productData = doc.data();

        // Prepare the product data for the worksheet
        const productWorksheetData = [
          ["Material ID", "Quantity", "Constant"] // Headers for each product's worksheet
        ];

        // Sort material IDs in the product
        const sortedMaterialIds = Object.keys(productData).sort();

        // Loop through each material and add it to the worksheet data
        sortedMaterialIds.forEach(materialId => {
          const materialData = productData[materialId];
          productWorksheetData.push([
            materialId,
            materialData.quantity,
            materialData.constant
          ]);
        });

        // Ensure the sheet name is within the 31 character limit
        const sheetName = productId.length > 31 ? productId.slice(0, 31) : productId;

        // Create a worksheet for the product and append it to the workbook
        const productWorksheet = XLSX.utils.aoa_to_sheet(productWorksheetData);
        XLSX.utils.book_append_sheet(workbook, productWorksheet, sheetName); // Sheet name is the product ID
      });

      // Write workbook to binary array
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

      // Create a Blob from the workbook
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      // Trigger the download of the Excel file
      saveAs(blob, "Products_Details.xlsx");
      console.log("✅ All product details downloaded successfully.");
    } catch (error) {
      console.error("❌ Error exporting product details:", error);
    }
}