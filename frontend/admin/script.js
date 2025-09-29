// API基础URL
const API_BASE_URL = 'http://localhost:3000/api';

// 全局变量
let currentUser = null;
let authToken = null;

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
function initializeApp() {
    // 检查是否已登录
    const token = localStorage.getItem('authToken');
    if (token) {
        authToken = token;
        currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        showMainInterface();
    } else {
        showLoginModal();
    }
    
    // 绑定事件监听器
    bindEventListeners();
}

// 绑定事件监听器
function bindEventListeners() {
    // 侧边栏切换按钮
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
            if (window.innerWidth <= 768) {
                sidebarOverlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
            }
        });
    }
    
    // 侧边栏宽度调整
    initSidebarResizer();
    
    // 点击遮罩层关闭侧边栏
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('open');
            sidebarOverlay.style.display = 'none';
        });
    }
    
    // 窗口大小改变时处理侧边栏
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('open');
            sidebarOverlay.style.display = 'none';
        }
    });
    
    // 移除全局事件监听器，让HTML中的onclick属性正常工作
    
    // 有子菜单的项目点击
    document.querySelectorAll('.menu-item.has-submenu .menu-item-header').forEach(header => {
        header.addEventListener('click', function(e) {
            e.stopPropagation();
            const menuItem = this.closest('.menu-item');
            menuItem.classList.toggle('open');
        });
    });
    
    // 模态框关闭
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            hideModal();
        });
    });
    
    // 点击模态框外部关闭
    const modal = document.getElementById('modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal();
            }
        });
    }
    
    // 搜索功能
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            // 实现搜索逻辑
            console.log('搜索:', query);
        });
    }
}

// 显示登录模态框
function showLoginModal() {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>管理员登录</h3>
            </div>
            <div class="modal-body">
                <form id="login-form">
                    <div class="form-group">
                        <label for="username">用户名</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">密码</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn btn-primary" style="width: 100%;">登录</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    modal.classList.add('active');
    
    // 绑定登录表单提交
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            
            // 保存到本地存储
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            hideModal();
            showMainInterface();
        } else {
            alert('登录失败: ' + data.message);
        }
    } catch (error) {
        console.error('登录错误:', error);
        alert('登录失败，请检查网络连接');
    }
}

// 显示主界面
function showMainInterface() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('active');
    }
    loadDashboardData();
}

// 显示页面
function showPage(pageId) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.classList.add('active');
        
        // 更新侧边栏活动状态
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeMenuItem = document.querySelector(`[data-page="${pageId}"]`);
        if (activeMenuItem) {
            activeMenuItem.classList.add('active');
        }
        
        // 加载页面数据
        loadPageData(pageId);
    }
}

// 加载页面数据
function loadPageData(pageId) {
    switch(pageId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'products':
            loadProductsData();
            break;
        case 'orders':
            loadOrdersData();
            break;
        default:
            console.log('页面数据加载:', pageId);
    }
}

// 加载仪表板数据
async function loadDashboardData() {
    try {
        // 加载统计数据
        const statsResponse = await fetch(`${API_BASE_URL}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            updateStatsCards(stats);
        }
        
        // 加载热卖商品
        const hotProductsResponse = await fetch(`${API_BASE_URL}/statistics/hot-products`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (hotProductsResponse.ok) {
            const hotProducts = await hotProductsResponse.json();
            updateHotProductsTable(hotProducts);
        }
        
        // 加载热卖品牌和分类（模拟数据）
        updateHotBrandsTable();
        updateHotCategoriesTable();
        
    } catch (error) {
        console.log('加载仪表板数据失败，使用模拟数据:', error.message);
        // 使用模拟数据
        loadMockDashboardData();
    }
}

// 加载模拟仪表板数据
function loadMockDashboardData() {
    // 模拟统计数据
    const mockStats = {
        todaySales: 12345.67,
        todayOrders: 89,
        totalUsers: 1234,
        totalProducts: 234
    };
    updateStatsCards(mockStats);
    
    // 模拟热卖商品
    const mockHotProducts = [
        { id: '001', name: '维骨力1', sales: 156, revenue: 2340.50 },
        { id: '002', name: '维骨力2', sales: 89, revenue: 1780.20 },
        { id: '003', name: '维骨力3', sales: 67, revenue: 1340.80 }
    ];
    updateHotProductsTable(mockHotProducts);
    
    // 加载热卖品牌和分类
    updateHotBrandsTable();
    updateHotCategoriesTable();
}

// 更新统计卡片
function updateStatsCards(stats) {
    document.getElementById('today-gmv').textContent = `¥${(stats.todaySales || 0).toFixed(2)}`;
    document.getElementById('today-orders').textContent = stats.todayOrders || 0;
    document.getElementById('week-gmv').textContent = `¥${(stats.weekSales || 0).toFixed(2)}`;
    document.getElementById('week-orders').textContent = stats.weekOrders || 0;
}

// 更新热卖商品表格
function updateHotProductsTable(products) {
    const tbody = document.getElementById('hot-products-table');
    if (products && products.length > 0) {
        tbody.innerHTML = products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${product.weeklySales || 0}</td>
                <td>¥${(product.weeklyGMV || 0).toFixed(2)}</td>
                <td>${product.category || '未分类'}</td>
                <td>${product.brand || '无品牌'}</td>
                <td>
                    <button class="action-btn edit" onclick="viewProduct(${product.id})">查看商品</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无数据</td></tr>';
    }
}

// 更新热卖品牌表格（模拟数据）
function updateHotBrandsTable() {
    const tbody = document.getElementById('hot-brands-table');
    if (!tbody) return; // 如果元素不存在，直接返回
    
    const mockBrands = [
        { id: '09524', name: '贝因美', weeklySales: 3262, weeklyGMV: 92852.42 },
        { id: '09525', name: '飞鹤', weeklySales: 2156, weeklyGMV: 65432.10 },
        { id: '09526', name: '君乐宝', weeklySales: 1890, weeklyGMV: 45678.90 }
    ];
    
    tbody.innerHTML = mockBrands.map(brand => `
        <tr>
            <td>${brand.id}</td>
            <td>${brand.name}</td>
            <td>${brand.weeklySales}</td>
            <td>¥${brand.weeklyGMV.toFixed(2)}</td>
        </tr>
    `).join('');
}

// 更新热卖分类表格（模拟数据）
function updateHotCategoriesTable() {
    const tbody = document.getElementById('hot-categories-table');
    if (!tbody) return; // 如果元素不存在，直接返回
    
    const mockCategories = [
        { id: '3242', name: '女士维生素', weeklySales: 632, weeklyGMV: 2950.53 },
        { id: '3243', name: '婴幼儿奶粉', weeklySales: 456, weeklyGMV: 12345.67 },
        { id: '3244', name: '保健品', weeklySales: 321, weeklyGMV: 8765.43 }
    ];
    
    tbody.innerHTML = mockCategories.map(category => `
        <tr>
            <td>${category.id}</td>
            <td>${category.name}</td>
            <td>${category.weeklySales}</td>
            <td>¥${category.weeklyGMV.toFixed(2)}</td>
        </tr>
    `).join('');
}

// 加载用户数据
async function loadUsersData() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            updateUsersTable(users);
        } else {
            console.error('加载用户数据失败');
        }
    } catch (error) {
        console.error('加载用户数据失败:', error);
    }
}

// 更新用户表格
function updateUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (users && users.length > 0) {
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>
                    <span class="status-badge ${user.role === 'admin' ? 'status-paid' : 'status-pending'}">
                        ${user.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                </td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="action-btn delete" onclick="deleteUser(${user.id})">删除</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">暂无数据</td></tr>';
    }
}

// 加载商品数据
async function loadProductsData() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/products/all`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const products = await response.json();
            updateProductsTable(products);
        } else {
            console.error('加载商品数据失败');
        }
    } catch (error) {
        console.error('加载商品数据失败:', error);
    }
}

// 更新商品表格
function updateProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    if (products && products.length > 0) {
        tbody.innerHTML = products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>¥${product.price}</td>
                <td>${product.stock}</td>
                <td>
                    <span class="status-badge ${product.status === 'active' ? 'status-paid' : 'status-pending'}">
                        ${product.status === 'active' ? '上架' : '下架'}
                    </span>
                </td>
                <td>
                    <button class="action-btn edit" onclick="editProduct(${product.id})">编辑</button>
                    <button class="action-btn delete" onclick="deleteProduct(${product.id})">删除</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
    }
}

// 加载订单数据
async function loadOrdersData() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const orders = await response.json();
            updateOrdersTable(orders);
        } else {
            console.error('加载订单数据失败');
        }
    } catch (error) {
        console.error('加载订单数据失败:', error);
    }
}

// 更新订单表格
function updateOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    if (orders && orders.length > 0) {
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.order_number}</td>
                <td>${order.user_name || '未知用户'}</td>
                <td>¥${order.total_amount}</td>
                <td>
                    <span class="status-badge status-${order.status}">
                        ${getStatusText(order.status)}
                    </span>
                </td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="action-btn edit" onclick="viewOrder(${order.id})">查看</button>
                    <button class="action-btn edit" onclick="updateOrderStatus(${order.id})">更新状态</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
    }
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '待支付',
        'paid': '已支付',
        'shipped': '已发货',
        'finished': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

// 删除用户
async function deleteUser(userId) {
    if (confirm('确定要删除这个用户吗？')) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                alert('用户删除成功');
                loadUsersData();
            } else {
                alert('删除失败');
            }
        } catch (error) {
            console.error('删除用户失败:', error);
            alert('删除失败');
        }
    }
}

// 删除商品
async function deleteProduct(productId) {
    if (confirm('确定要删除这个商品吗？')) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                alert('商品删除成功');
                loadProductsData();
            } else {
                alert('删除失败');
            }
        } catch (error) {
            console.error('删除商品失败:', error);
            alert('删除失败');
        }
    }
}

// 查看商品
function viewProduct(productId) {
    alert(`查看商品 ${productId} 的详情`);
}

// 编辑商品
function editProduct(productId) {
    alert(`编辑商品 ${productId}`);
}

// 查看订单
function viewOrder(orderId) {
    alert(`查看订单 ${orderId} 的详情`);
}

// 更新订单状态
function updateOrderStatus(orderId) {
    const newStatus = prompt('请输入新状态 (pending/paid/shipped/finished/cancelled):');
    if (newStatus) {
        updateOrderStatusAPI(orderId, newStatus);
    }
}

// 更新订单状态API
async function updateOrderStatusAPI(orderId, status) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert('订单状态更新成功');
            loadOrdersData();
        } else {
            alert('更新失败');
        }
    } catch (error) {
        console.error('更新订单状态失败:', error);
        alert('更新失败');
    }
}

// 隐藏模态框
function hideModal() {
    document.getElementById('modal').classList.remove('active');
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        authToken = null;
        currentUser = null;
        showLoginModal();
    }
}

// 添加用户按钮点击
document.addEventListener('click', function(e) {
    if (e.target.id === 'add-user-btn') {
        showCreateUserModal();
    }
});

// 显示创建用户模态框
function showCreateUserModal() {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>创建新用户</h3>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <form id="create-user-form">
                    <div class="form-group">
                        <label for="new-username">用户名</label>
                        <input type="text" id="new-username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="new-password">密码</label>
                        <input type="password" id="new-password" name="password" required>
                    </div>
                    <div class="form-group">
                        <label for="new-role">角色</label>
                        <select id="new-role" name="role">
                            <option value="customer">普通用户</option>
                            <option value="admin">管理员</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn btn-primary" style="width: 100%;">创建用户</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    modal.classList.add('active');
    
    // 绑定创建用户表单提交
    document.getElementById('create-user-form').addEventListener('submit', handleCreateUser);
}

// 处理创建用户
async function handleCreateUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ username, password, role })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('用户创建成功');
            hideModal();
            loadUsersData();
        } else {
            alert('创建失败: ' + data.message);
        }
    } catch (error) {
        console.error('创建用户失败:', error);
        alert('创建失败，请检查网络连接');
    }
}

// 初始化侧边栏宽度调整功能
function initSidebarResizer() {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    const mainContent = document.querySelector('.main-content');
    
    if (!sidebar || !resizer || !mainContent) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    resizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
    });
    
    function handleResize(e) {
        if (!isResizing) return;
        
        const newWidth = startWidth + (e.clientX - startX);
        const minWidth = 200;
        const maxWidth = 500;
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            sidebar.style.width = newWidth + 'px';
            mainContent.style.marginLeft = newWidth + 'px';
        }
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        
        // 保存宽度到本地存储
        const currentWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
        localStorage.setItem('sidebarWidth', currentWidth);
    }
    
    // 从本地存储恢复宽度
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
        const width = parseInt(savedWidth, 10);
        if (width >= 200 && width <= 500) {
            sidebar.style.width = width + 'px';
            mainContent.style.marginLeft = width + 'px';
        }
    }

    // 功能提示函数
    function showFeatureAlert(featureName) {
        alert(`${featureName}功能正在开发中，敬请期待！`);
    }

    // 公共工具栏 - 子菜单切换功能
    function toggleSubmenu(element) {
        const menuItem = element.closest('.menu-item');
        const submenu = menuItem.querySelector('.submenu');
        const arrow = element.querySelector('.submenu-arrow');
        
        if (submenu.classList.contains('open')) {
            submenu.classList.remove('open');
            arrow.textContent = '▼';
        } else {
            submenu.classList.add('open');
            arrow.textContent = '▲';
        }
    }

    // 公共工具栏 - 页面跳转时设置菜单状态
    function setMenuState(pageName) {
        // 重置所有菜单状态
        const allMenus = document.querySelectorAll('.menu-item.has-submenu');
        allMenus.forEach(menu => {
            const submenu = menu.querySelector('.submenu');
            const arrow = menu.querySelector('.submenu-arrow');
            submenu.classList.remove('open');
            arrow.textContent = '▼';
        });
        
        // 设置当前页面的菜单状态
        if (pageName === 'orders') {
            const ordersMenu = document.querySelector('.menu-item[data-page="orders"]');
            if (ordersMenu) {
                const submenu = ordersMenu.querySelector('.submenu');
                const arrow = ordersMenu.querySelector('.submenu-arrow');
                submenu.classList.add('open');
                arrow.textContent = '▲';
            }
        } else if (pageName === 'products') {
            const productsMenu = document.querySelector('.menu-item[data-page="products"]');
            if (productsMenu) {
                const submenu = productsMenu.querySelector('.submenu');
                const arrow = productsMenu.querySelector('.submenu-arrow');
                submenu.classList.add('open');
                arrow.textContent = '▲';
            }
        }
    }

    // 完全移除事件监听器，所有导航都通过onclick处理
}

// ===== 将公共工具栏相关函数暴露为全局，供各页面内联 onclick 调用 =====
function showFeatureAlert(featureName) {
    alert(`${featureName}功能正在开发中，敬请期待！`);
}

function toggleSubmenu(element) {
    const menuItem = element.closest('.menu-item');
    const submenu = menuItem ? menuItem.querySelector('.submenu') : null;
    const arrow = element ? element.querySelector('.submenu-arrow') : null;
    if (!submenu) return;
    if (submenu.classList.contains('open')) {
        submenu.classList.remove('open');
        if (arrow) arrow.textContent = '▼';
    } else {
        submenu.classList.add('open');
        if (arrow) arrow.textContent = '▲';
    }
}

function setMenuState(pageName) {
    const allMenus = document.querySelectorAll('.menu-item.has-submenu');
    allMenus.forEach(menu => {
        const submenu = menu.querySelector('.submenu');
        const arrow = menu.querySelector('.submenu-arrow');
        if (submenu) submenu.classList.remove('open');
        if (arrow) arrow.textContent = '▼';
    });
    if (pageName === 'orders') {
        const ordersMenu = document.querySelector('.menu-item[data-page="orders"]');
        if (ordersMenu) {
            const submenu = ordersMenu.querySelector('.submenu');
            const arrow = ordersMenu.querySelector('.submenu-arrow');
            if (submenu) submenu.classList.add('open');
            if (arrow) arrow.textContent = '▲';
        }
    } else if (pageName === 'products') {
        const productsMenu = document.querySelector('.menu-item[data-page="products"]');
        if (productsMenu) {
            const submenu = productsMenu.querySelector('.submenu');
            const arrow = productsMenu.querySelector('.submenu-arrow');
            if (submenu) submenu.classList.add('open');
            if (arrow) arrow.textContent = '▲';
        }
    }
}

window.showFeatureAlert = showFeatureAlert;
window.toggleSubmenu = toggleSubmenu;
window.setMenuState = setMenuState;