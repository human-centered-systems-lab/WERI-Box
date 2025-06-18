// Updated script.js with multi-category support
const tableBody = document.querySelector('#papers-table tbody');
const filtersDiv = document.querySelector('#filters');
let activeFilters = {};

let originalData = [];

// Load data from JSON files and create filters
async function loadData() {
    try {
        const [jsonData, orderingData] = await Promise.all([
            fetch('data.json').then(res => {
                if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
                return res.json();
            }),
            loadOrderingData(),
        ]);

        originalData = jsonData;
        const sortedData = sortData(jsonData, 'Author');
        createFilters(jsonData, orderingData);
        renderTable(sortedData);
        updateDisabledButtons();
    } catch (error) {
        console.error('Error fetching JSON data:', error);
    }
}

// Load ordering data for the filter keys and buttons
async function loadOrderingData() {
    try {
        const response = await fetch('ordering.json');
        if (!response.ok) {
            console.warn('Could not load ordering JSON data. Using default ordering.');
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching ordering JSON data:', error);
        return null;
    }
}

// Render the table with the given data
function renderTable(data) {
    const noDataMessage = document.getElementById('no-data-message');
    if (data.length === 0) {
        noDataMessage.style.display = 'block';
    } else {
        noDataMessage.style.display = 'none';
    }

    tableBody.innerHTML = data.map(paper => {
        let displayDOI = paper.DOI_URL.startsWith('https://doi.org/')
            ? paper.DOI_URL.replace('https://doi.org/', '')
            : paper.DOI_URL.slice(0, 30) + '...';
        return `
      <tr>
        <td>${paper.Author}</td>
        <td>${paper.Year}</td>
        <td>${paper.Paper}</td>
        <td><a href="${paper.DOI_URL}" target="_blank">${displayDOI}</a></td>
      </tr>
    `;
    }).join('');

    // Add hover listeners
    tableBody.querySelectorAll('tr').forEach((row, idx) => {
        row.addEventListener('mouseover', () => {
            const rowData = data[idx];
            highlightFilters(rowData);
        });
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('mouseout', () => highlightFilters({}));
    });
}

// Create filter groups based on the provided data and ordering
function createFilters(jsonData, orderingData) {
    let filterKeys, groups;
    if (orderingData) {
        filterKeys = orderingData.keysOrder;
        groups = orderingData.groups;
    } else {
        filterKeys = Object.keys(jsonData[0]).filter(
            k => !['id','Author','Year','Paper','DOI_URL'].includes(k)
        );
        groups = [{ name: '', keys: filterKeys }];
    }

    filtersDiv.innerHTML = '';

    groups.forEach(group => {
        const groupContainer = document.createElement('div');
        groupContainer.classList.add('filter-group-container');
        const h3 = document.createElement('h3');
        h3.textContent = group.name;
        h3.classList.add('filter-group-name');
        groupContainer.appendChild(h3);

        group.keys.forEach(key => {
            const filterGroup = document.createElement('div');
            filterGroup.classList.add('filter-group');
            const span = document.createElement('span');
            span.textContent = key;
            span.classList.add('filter-key');
            filterGroup.appendChild(span);

            // Collect unique values including arrays
            let uniqueValues;
            if (orderingData) {
                uniqueValues = orderingData.buttonsOrder[key];
            } else {
                uniqueValues = Array.from(
                    new Set(
                        jsonData.flatMap(paper => {
                            const v = paper[key];
                            return Array.isArray(v) ? v : [v];
                        })
                    )
                ).sort();
            }

            uniqueValues.forEach(value => {
                const btn = document.createElement('button');
                btn.textContent = value;
                btn.classList.add('filter-btn');
                btn.addEventListener('click', () => {
                    btn.classList.toggle('active');
                    applyFilters();
                });
                filterGroup.appendChild(btn);
            });

            span.addEventListener('click', () => {
                filterGroup.querySelectorAll('.filter-btn.active').forEach(b => b.classList.remove('active'));
                applyFilters();
            });

            groupContainer.appendChild(filterGroup);
        });
        filtersDiv.appendChild(groupContainer);
    });
    adjustFilterButtonsWidth();
}

// Apply the active filters to the table
function applyFilters() {
    const filters = Array.from(document.querySelectorAll('.filter-group')).reduce((acc, fg) => {
        const key = fg.querySelector('.filter-key').textContent;
        const vals = Array.from(fg.querySelectorAll('.filter-btn.active')).map(b => b.textContent);
        if (vals.length) acc[key] = vals;
        return acc;
    }, {});

    const filtered = originalData.filter(p => {
        return Object.entries(filters).every(([key, vals]) => {
            const cell = p[key];
            const arr = Array.isArray(cell) ? cell : [cell];
            return arr.some(v => vals.includes(v));
        });
    });

    const sorted = sortData(filtered, 'Author');
    renderTable(sorted);
    updateDisabledButtons();
}

// Sort utility remains unchanged
function sortData(data, column, asc = true) {
    return data.slice().sort((a,b) => {
        const va = column==='Year'?+a[column]:a[column].toString().toLowerCase();
        const vb = column==='Year'?+b[column]:b[column].toString().toLowerCase();
        return (va<vb?-1:(va>vb?1:0)) * (asc?1:-1);
    });
}

// Adjust widths unchanged
function adjustFilterButtonsWidth() {const filterGroups = document.querySelectorAll('.filter-group');
    const filtersContainer = document.getElementById('filters');
    const containerWidth = filtersContainer.clientWidth;

    filterGroups.forEach((filterGroup) => {
        const buttons = filterGroup.querySelectorAll('.filter-btn');
        const totalWidth = Array.from(buttons).reduce((width, btn) => {
            return width + btn.offsetWidth + parseFloat(window.getComputedStyle(btn).marginRight);
        }, 0);
        const remainingWidth = containerWidth - totalWidth;
        const extraWidth = remainingWidth / buttons.length;

        buttons.forEach((btn) => {
            btn.style.width = btn.offsetWidth + extraWidth + 'px';
            btn.style.boxSizing = 'border-box';
        });
    });
 }

// Disable buttons considering arrays
function updateDisabledButtons() {
    document.querySelectorAll('.filter-btn').forEach(button => {
        const group = button.closest('.filter-group');
        const key = group.querySelector('.filter-key').textContent;
        const value = button.textContent;
        button.classList.toggle('active');
        const tempFilters = Array.from(document.querySelectorAll('.filter-group')).reduce((acc, fg) => {
            const k = fg.querySelector('.filter-key').textContent;
            const vs = Array.from(fg.querySelectorAll('.filter-btn.active')).map(b=>b.textContent);
            if(vs.length) acc[k]=vs;
            return acc;
        }, {});
        const filtered = originalData.filter(p=> Object.entries(tempFilters).every(([k,vs]) => {
            const cell = p[k]; const arr = Array.isArray(cell)?cell:[cell]; return arr.some(v=>vs.includes(v));
        }));
        button.classList.toggle('active');
        if(!button.classList.contains('active') && filtered.length===0) {
            button.classList.add('button-disabled');
        } else button.classList.remove('button-disabled');
    });
}

// Highlight hovered row allowing multiple categories
function highlightFilters(rowData) {
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('hover-highlight'));
    Object.entries(rowData).forEach(([key, cell]) => {
        const arr = Array.isArray(cell)?cell:[cell];
        arr.forEach(v => {
            const btn = Array.from(document.querySelectorAll('.filter-btn')).find(b => {
                return b.parentElement.querySelector('.filter-key').textContent===key && b.textContent===v;
            });
            if(btn) btn.classList.add('hover-highlight');
        });
    });
}

// Title bar scroll behavior
const titleBar = document.getElementById("title-bar");
window.addEventListener("scroll", () => {
    titleBar.style.transform = window.scrollY > 35 ? "translateY(-100%)" : "";
});

window.onload = () => {
    loadData();
    setTimeout(adjustFilterButtonsWidth, 100);
};
