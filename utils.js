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

