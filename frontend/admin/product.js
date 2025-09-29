// 商品管理页面专用JavaScript
// 页面特定的初始化
document.addEventListener('DOMContentLoaded', function() {
    // 刷新时重定向到数据总览
    if (performance.navigation.type === 1) { // 刷新页面
        window.location.href = 'index.html';
    }
    
    // 使用公共工具栏逻辑设置菜单状态
    setMenuState('products');
    
    // 加载品牌数据到选择框
    loadBrandsToSelect();

    // 初始化分类选择与折叠
    initCategorySelectorFix();

    // 初始化图片上传与详情编辑器
    initImageUpload();
    initDetailEditor();

    // 初始化草稿保存/恢复
    initDraft();

    // 绑定提交商品
    bindSubmitProduct();

    // 绑定“新增品牌”按钮
    const addBrandBtn = document.getElementById('add-brand-btn');
    if (addBrandBtn) {
        addBrandBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openAddBrandModal();
        });
    }

    // 页面进入时渲染本地“商品列表”（解决刷新后看不到刚添加数据的问题）
    renderProductListFromLocal();

    // 页面进入时渲染本地“品牌列表”（解决刷新后品牌消失的问题）
    renderBrandListFromLocal();
});

// 分类中文名映射与工具
const CATEGORY_TEXT_MAP = {
    'personal-care': '洗护用品',
    'health-supplements': '保健用品',
    'baby-formula': '奶粉',
    'clothing': '服饰专区',
    'shampoo': '洗发水',
    'conditioner': '护发素',
    'body-wash': '沐浴露',
    'face-wash': '洗面奶',
    'vitamins': '维生素',
    'protein': '蛋白粉',
    'health-pills': '保健品',
    'supplements': '营养补充剂',
    'infant-formula': '婴儿奶粉',
    'toddler-formula': '幼儿奶粉',
    'special-formula': '特殊配方奶粉',
    'organic-formula': '有机奶粉',
    'mens-clothing': '男装',
    'womens-clothing': '女装',
    'childrens-clothing': '童装',
    'accessories': '配饰'
};

function getCategoryTextByCode(code) {
    return CATEGORY_TEXT_MAP[code] || code || '';
}

// 加载品牌数据到选择框
function loadBrandsToSelect() {
    const brandSelect = document.getElementById('product-brand');
    if (!brandSelect) return;
    // 从本地存储读取品牌列表
    const brands = getLocalBrandList();
    brandSelect.innerHTML = '<option value="">请选择</option>';
    brands.forEach(b => {
        const option = document.createElement('option');
        option.value = b.id;
        option.textContent = b.name;
        brandSelect.appendChild(option);
    });
}

// 商品管理模块切换
function showProductModule(moduleName) {
    // 隐藏所有模块
    document.querySelectorAll('.product-module').forEach(module => {
        module.classList.remove('active');
    });
    
    // 显示目标模块
    const targetModule = document.getElementById(moduleName + '-module');
    if (targetModule) {
        targetModule.classList.add('active');
        
        // 更新页面标题
        const pageTitle = document.getElementById('page-title');
        switch(moduleName) {
            case 'product-list':
                pageTitle.textContent = '后台-商品列表';
                break;
            case 'add-product':
                pageTitle.textContent = '后台-新增商品';
                break;
            case 'brand-category':
                pageTitle.textContent = '后台-品牌分类';
                break;
        }
        
        // 如果是品牌分类模块，重新加载品牌选择框
        if (moduleName === 'brand-category') {
            setTimeout(() => {
                loadBrandsToSelect();
            }, 100);
        }
    }
}

// 修复：分类选择导致覆盖后续区域，选择完后自动折叠
function initCategorySelectorFix() {
    const selector = document.querySelector('.category-selector');
    if (!selector) return;
    const left = selector.querySelectorAll('.category-column .category-item[data-category]');
    const right = document.getElementById('subcategory-list');
    // 左侧切换时高亮并刷新右侧二级列表
    const subcategories = {
        'personal-care': [
            { value: 'shampoo', text: '洗发水' },
            { value: 'conditioner', text: '护发素' },
            { value: 'body-wash', text: '沐浴露' },
            { value: 'face-wash', text: '洗面奶' }
        ],
        'health-supplements': [
            { value: 'vitamins', text: '维生素' },
            { value: 'protein', text: '蛋白粉' },
            { value: 'health-pills', text: '保健品' },
            { value: 'supplements', text: '营养补充剂' }
        ],
        'baby-formula': [
            { value: 'infant-formula', text: '婴儿奶粉' },
            { value: 'toddler-formula', text: '幼儿奶粉' },
            { value: 'special-formula', text: '特殊配方奶粉' },
            { value: 'organic-formula', text: '有机奶粉' }
        ],
        'clothing': [
            { value: 'mens-clothing', text: '男装' },
            { value: 'womens-clothing', text: '女装' },
            { value: 'childrens-clothing', text: '童装' },
            { value: 'accessories', text: '配饰' }
        ]
    };
    left.forEach(item => {
        item.addEventListener('click', function() {
            left.forEach(ci => ci.classList.remove('active'));
            this.classList.add('active');
            if (!right) return;
            const category = this.getAttribute('data-category');
            const list = subcategories[category] || [];
            right.innerHTML = '';
            list.forEach(sc => {
                const el = document.createElement('div');
                el.className = 'category-item';
                el.setAttribute('data-subcategory', sc.value);
                el.textContent = sc.text;
                el.addEventListener('click', function() {
                    right.querySelectorAll('.category-item').forEach(si => si.classList.remove('active'));
                    this.classList.add('active');
                });
                right.appendChild(el);
            });
            if (right.firstElementChild) right.firstElementChild.classList.add('active');
        });
    });
    // 当右侧选择发生时，折叠分类区域
    if (right) {
        right.addEventListener('click', (e) => {
            const item = e.target.closest('.category-item');
            if (item) {
                
                right.querySelectorAll('.category-item').forEach(si => si.classList.remove('active'));
                item.classList.add('active');
            }
        });
    }
    // 允许随时重新展开：点击已选择提示或标签区域即可展开
    const formGroup = selector.closest('.form-group');
    if (formGroup) {
        formGroup.addEventListener('click', (e) => {
            const hitTip = e.target.closest('.category-selected-tip');
            const isLabel = e.target.tagName === 'LABEL';
            if (hitTip || isLabel) {
                selector.classList.remove('collapsed');
            }
        });
    }
    // 兼容老代码保留的 label 变量（无功能）
    const label = document.querySelector('label[for="product-brand"]')?.parentElement?.nextElementSibling;
    const confirmBtn = document.getElementById('confirm-category-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            selector.classList.add('collapsed');
            // 将选择结果写回到显示（在“商品分类”label后面追加文本）
            const selected = getSelectedCategory();
            const formGroup = selector.closest('.form-group');
            let tip = formGroup.querySelector('.category-selected-tip');
            if (!tip) {
                tip = document.createElement('div');
                tip.className = 'category-selected-tip';
                tip.style.marginTop = '6px';
                tip.style.color = '#666';
                formGroup.appendChild(tip);
            }
            const l1 = getCategoryTextByCode(selected.level1);
            const l2 = getCategoryTextByCode(selected.level2);
            tip.innerHTML = (selected.level1 && selected.level2)
                ? `<span style="padding:4px 8px;background:#f6f7fb;border-radius:6px;">已选择：<b>${l1}</b> / <b>${l2}</b></span>
                   <button type="button" class="reselect-category-btn" style="margin-left:8px;padding:2px 8px;font-size:12px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;">重新选择</button>`
                : '<span style="color:#aaa">未选择</span> <button type="button" class="reselect-category-btn" style="margin-left:8px;padding:2px 8px;font-size:12px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;">选择分类</button>';
            // 小按钮：点击直接展开分类选择器
            const reselectBtn = tip.querySelector('.reselect-category-btn');
            if (reselectBtn) {
                reselectBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    selector.classList.remove('collapsed');
                });
            }
        });
    }
}

// 新增品牌相关函数
function openAddBrandModal() {
    document.getElementById('add-brand-modal').style.display = 'flex';
    initLogoUpload();
}

function closeAddBrandModal() {
    document.getElementById('add-brand-modal').style.display = 'none';
    // 重置表单
    document.getElementById('add-brand-form').reset();
    // 重置Logo预览
    const logoPreview = document.getElementById('logo-preview');
    logoPreview.querySelector('img').style.display = 'none';
    logoPreview.querySelector('.upload-placeholder').style.display = 'flex';
}

// 详情编辑器
function initDetailEditor() {
    const editor = document.getElementById('product-details');
    const preview = document.getElementById('detail-preview-content');
    const refreshBtn = document.getElementById('refresh-detail-preview');
    // 让左侧“刷新”按钮也刷新预览
    const leftRefreshBtn = document.querySelector('.detail-preview .btn.btn-secondary, .detail-preview button.btn.btn-secondary');
    function renderFullPreview() {
        const mainImgs = Array.from(document.querySelectorAll('#main-images .uploaded-image img')).map(img => img.src);
        const detailImgs = Array.from(document.querySelectorAll('#detail-images .uploaded-image img')).map(img => img.src);
        const detailsHtml = editor ? editor.value : '';
        const galleryMain = mainImgs.length ? `<div class="image-upload-area">${mainImgs.map(s=>`<div class="uploaded-image"><img src="${s}"></div>`).join('')}</div>` : '';
        const textBlock = `<div class="preview-text">${detailsHtml ? detailsHtml : '请输入商品详情'}</div>`;
        const galleryDetail = detailImgs.length ? `<div class="image-upload-area" style="margin-top:6px;">${detailImgs.map(s=>`<div class="uploaded-image"><img src="${s}"></div>`).join('')}</div>` : '';
        preview.innerHTML = (galleryMain + textBlock + galleryDetail);
    }
    if (editor && preview) {
        editor.addEventListener('input', renderFullPreview);
        if (refreshBtn) refreshBtn.addEventListener('click', renderFullPreview);
        if (leftRefreshBtn) leftRefreshBtn.addEventListener('click', renderFullPreview);
        renderFullPreview();
    }
}

// 图片上传预览
function renderThumb(container, src, onRemove) {
    const wrap = document.createElement('div');
    wrap.className = 'uploaded-image';
    wrap.innerHTML = `<img src="${src}"><button type="button" class="remove-image-btn">×</button>`;
    wrap.querySelector('.remove-image-btn').addEventListener('click', () => {
        wrap.remove();
        if (onRemove) onRemove();
    });
    container.appendChild(wrap);
}

// 压缩一组 base64 图片，限制尺寸和质量，避免 localStorage 超限
async function compressBase64List(srcList, maxW, maxH, quality) {
    const compressOne = (src) => new Promise(resolve => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            const ratio = Math.min(maxW / w, maxH / h, 1);
            w = Math.floor(w * ratio);
            h = Math.floor(h * ratio);
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            try {
                const out = canvas.toDataURL('image/jpeg', quality);
                resolve(out);
            } catch (e) {
                resolve(src);
            }
        };
        img.onerror = function() { resolve(src); };
        img.src = src;
    });
    const results = [];
    for (const s of srcList) {
        // 跳过过大的 dataURL（> 1.5MB）
        if (s && s.length > 1.5 * 1024 * 1024 && s.startsWith('data:')) {
            results.push(await compressOne(s));
        } else {
            results.push(await compressOne(s));
        }
    }
    return results;
}

function initImageUpload() {
    // 主图 1-8
    const mainInput = document.getElementById('main-image-file');
    const mainContainer = document.getElementById('main-images');
    const mainCount = document.getElementById('main-images-count');
    if (mainInput && mainContainer && mainCount) {
        const updateCount = () => {
            const n = mainContainer.querySelectorAll('.uploaded-image').length;
            mainCount.textContent = `已上传 ${n}/8`;
        };
        mainInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            files.slice(0, 8 - mainContainer.querySelectorAll('.uploaded-image').length).forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    renderThumb(mainContainer, ev.target.result, updateCount);
                    updateCount();
                };
                reader.readAsDataURL(file);
            });
            mainInput.value = '';
        });
        updateCount();
    }

    // 详情图 1-8
    const detailInput = document.getElementById('detail-image-file');
    const detailContainer = document.getElementById('detail-images');
    const detailCount = document.getElementById('detail-images-count');
    if (detailInput && detailContainer && detailCount) {
        const updateCount = () => {
            const n = detailContainer.querySelectorAll('.uploaded-image').length;
            detailCount.textContent = `已上传${n}/8张`;
        };
        detailInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            files.slice(0, 8 - detailContainer.querySelectorAll('.uploaded-image').length).forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    renderThumb(detailContainer, ev.target.result, updateCount);
                    updateCount();
                };
                reader.readAsDataURL(file);
            });
            detailInput.value = '';
        });
        updateCount();
    }
}

// 草稿保存/恢复到localStorage
function initDraft() {
    const form = document.getElementById('add-product-form');
    if (!form) return;
    // 恢复
    try {
        const draft = JSON.parse(localStorage.getItem('productDraft') || 'null');
        if (draft) {
            Object.keys(draft).forEach(key => {
                const el = form.querySelector(`[name="${key}"]`);
                if (el) el.value = draft[key];
            });
            // 恢复详情
            const editor = document.getElementById('product-details');
            if (editor && draft.productDetails) {
                editor.value = draft.productDetails;
                const preview = document.getElementById('detail-preview');
                if (preview) preview.innerHTML = draft.productDetails || '<div class="preview-placeholder">请输入商品详情</div>';
            }
        }
    } catch (e) {}

    // 保存草稿按钮
    const saveBtn = document.getElementById('save-draft-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async function () {
            const data = {};
            const inputs = form.querySelectorAll('input[name], textarea[name], select[name]');
            inputs.forEach(i => {
                data[i.name] = i.value;
            });
            // 额外保存详情
            const editor = document.getElementById('product-details');
            data.productDetails = editor ? editor.value : '';
            // 保存分类
            data.category = getSelectedCategory();
            data.categoryText = {
                level1: getCategoryTextByCode(data.category.level1),
                level2: getCategoryTextByCode(data.category.level2)
            };
            // 保存品牌名
            const brandSelect = document.getElementById('product-brand');
            data.brandName = brandSelect ? (brandSelect.options[brandSelect.selectedIndex]?.text || '') : '';
            // 保存图片（先压缩并限制数量，避免超出 localStorage 配额）
            const rawMain = Array.from(document.querySelectorAll('#main-images .uploaded-image img')).map(img => img.src).slice(0, 4);
            const rawDetail = Array.from(document.querySelectorAll('#detail-images .uploaded-image img')).map(img => img.src).slice(0, 4);
            data.mainImages = await compressBase64List(rawMain, 800, 800, 0.6);
            data.detailImages = await compressBase64List(rawDetail, 800, 800, 0.6);
            localStorage.setItem('productDraft', JSON.stringify(data));
            alert('草稿已保存到本地');
            // 返回列表
            showProductModule('product-list');
            // 将草稿同步到商品列表临时数据（仅保存元数据，避免超出 localStorage 配额）
            const list = JSON.parse(localStorage.getItem('productListDraft') || '[]');
            const editingId = form.getAttribute('data-editing-id');
            if (editingId) {
                // 编辑模式：更新原有条目（不生成新ID）
                const idx = list.findIndex(x => x.id === editingId);
                if (idx >= 0) {
                    list[idx] = {
                        ...list[idx],
                        name: data.productName || list[idx].name,
                        price: data.price || list[idx].price,
                        stock: data.stock || list[idx].stock,
                        brandName: data.brandName || list[idx].brandName,
                        category: data.category,
                        categoryText: data.categoryText,
                        previewImage: (data.mainImages && data.mainImages[0]) || list[idx].previewImage,
                        updatedAt: Date.now()
                    };
                }
                try {
                    localStorage.setItem('product:' + editingId, JSON.stringify({ ...data, updatedAt: Date.now() }));
                } catch (e) {
                    alert('图片过大，草稿保存失败。请减少图片数量或分辨率。');
                    return;
                }
                localStorage.setItem('productListDraft', JSON.stringify(list));
                alert('草稿已更新');
            } else {
                // 新建草稿：生成新ID
                const draftId = 'DRAFT-' + Date.now();
                try {
                    localStorage.setItem('product:' + draftId, JSON.stringify(data));
                } catch (e) {
                    alert('图片过大，草稿保存失败。请减少图片数量或分辨率。');
                    return;
                }
                list.unshift({
                    id: draftId,
                    name: data.productName || '新商品',
                    price: data.price || 0,
                    stock: data.stock || 0,
                    status: 'draft',
                    brandName: data.brandName || '',
                    category: data.category,
                    categoryText: data.categoryText,
                    previewImage: (data.mainImages && data.mainImages[0]) || '',
                    createdAt: Date.now()
                });
                localStorage.setItem('productListDraft', JSON.stringify(list));
                alert('草稿已保存到本地');
            }
            renderProductListFromLocal();
        });
    }
}

function getSelectedCategory() {
    const level1 = document.querySelector('.category-column .category-item.active[data-category]');
    const level2 = document.querySelector('#subcategory-list .category-item.active');
    return {
        level1: level1 ? level1.getAttribute('data-category') : '',
        level2: level2 ? level2.getAttribute('data-subcategory') : ''
    };
}

function bindSubmitProduct() {
    const form = document.getElementById('add-product-form');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const data = {};
        const inputs = form.querySelectorAll('input[name], textarea[name], select[name]');
        inputs.forEach(i => { data[i.name] = i.value; });
        data.details = document.getElementById('product-details')?.value || '';
        data.category = getSelectedCategory();
        data.categoryText = {
            level1: getCategoryTextByCode(data.category.level1),
            level2: getCategoryTextByCode(data.category.level2)
        };
        const brandSelect = document.getElementById('product-brand');
        data.brandName = brandSelect ? (brandSelect.options[brandSelect.selectedIndex]?.text || '') : '';
        const rawMainS = Array.from(document.querySelectorAll('#main-images .uploaded-image img')).map(img => img.src).slice(0, 4);
        const rawDetailS = Array.from(document.querySelectorAll('#detail-images .uploaded-image img')).map(img => img.src).slice(0, 4);
        data.mainImages = await compressBase64List(rawMainS, 800, 800, 0.6);
        data.detailImages = await compressBase64List(rawDetailS, 800, 800, 0.6);
        // 判断是否编辑模式
        const editingId = form.getAttribute('data-editing-id');
        const list = JSON.parse(localStorage.getItem('productListDraft') || '[]');
        if (editingId) {
            // 更新列表元数据
            const idx = list.findIndex(x => x.id === editingId);
            if (idx >= 0) {
                list[idx] = {
                    ...list[idx],
                    name: data.productName || list[idx].name,
                    price: data.price || list[idx].price,
                    stock: data.stock || list[idx].stock,
                    brandName: data.brandName || list[idx].brandName,
                    category: data.category,
                    categoryText: data.categoryText,
                    previewImage: (data.mainImages && data.mainImages[0]) || list[idx].previewImage
                };
            }
            // 更新详情数据
            try {
                localStorage.setItem('product:' + editingId, JSON.stringify({
                    ...data,
                    updatedAt: Date.now()
                }));
            } catch (e) {
                alert('图片过大，修改保存失败。请减少图片数量或分辨率。');
                return;
            }
            alert('修改已保存!');
            form.removeAttribute('data-editing-id');
        } else {
            // 新增：生成ID，详情数据单独保存
            const newId = 'TEMP-' + Date.now();
            try {
                localStorage.setItem('product:' + newId, JSON.stringify({ ...data }));
            } catch (e) {
                alert('图片过大，提交失败。请减少图片数量或分辨率。');
                return;
            }
            list.unshift({
                id: newId,
                name: data.productName || '新商品',
                price: data.price || 0,
                stock: data.stock || 0,
                status: 'draft',
                brandName: data.brandName || '',
                category: data.category,
                categoryText: data.categoryText,
                previewImage: (data.mainImages && data.mainImages[0]) || '',
                createdAt: Date.now()
            });
            alert('商品提交成功!');
        }
        localStorage.setItem('productListDraft', JSON.stringify(list));
        // 清空草稿并返回列表
        localStorage.removeItem('productDraft');
        showProductModule('product-list');
        renderProductListFromLocal();
    });
}

// 分页相关变量
let currentPage = 1;
const itemsPerPage = 50;

// 将本地临时数据渲染到"商品列表"模块（演示用）
function renderProductListFromLocal() {
    const container = document.getElementById('products-list');
    if (!container) return;
    
    let list = JSON.parse(localStorage.getItem('productListDraft') || '[]');
    
    // 应用筛选
    list = applyFilters(list);
    
    // 更新统计信息
    updateProductStats(list.length);
    
    // 计算分页
    const totalPages = Math.ceil(list.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = list.slice(startIndex, endIndex);
    
    // 渲染商品列表
    const html = pageData.map((p, idx) => `
        <div class="product-item">
            <div class="product-checkbox"><input type="checkbox" class="product-select" onchange="updateBatchDeleteButton()"></div>
            <div class="product-image"><img src="${p.previewImage || (p.mainImages && p.mainImages[0]) || 'https://via.placeholder.com/80x80'}" alt="商品图片"></div>
            <div class="product-info">
                <div class="product-name">${p.name || '名称'}</div>
                <div class="product-id">ID: ${p.id}</div>
                <div class="product-attributes">
                    <span class="attr-item">价格: ${p.price || 0}</span>
                    <span class="attr-item">库存: ${p.stock || 0}</span>
                    <span class="attr-item">销量: ${p.sales || 0}</span>
                    <span class="attr-item">SKU数量: ${p.skuCount || 1}</span>
                </div>
            </div>
            <div class="product-status"><span class="status-badge ${p.status === 'delisted' ? 'status-off' : (p.status === 'active' ? 'status-on' : 'status-inactive')}">${p.status === 'delisted' ? '已下架' : (p.status === 'active' ? '已上架' : '草稿')}</span></div>
            <div class="product-time"><span>创建时间: ${p.createdAt ? new Date(p.createdAt).toLocaleString() : new Date().toLocaleString()}</span></div>
            <div class="product-actions">
                <a href="#" class="action-link" onclick="viewLocalProduct('${p.id}')">查看详情</a>
                <a href="#" class="action-link" onclick="editLocalProduct('${p.id}')">修改商品</a>
                ${p.status === 'draft' ? `<a href="#" class="action-link" onclick="relistLocalProduct('${p.id}')">上架商品</a>` : `<a href="#" class="action-link" onclick="${p.status === 'delisted' ? 'relistLocalProduct' : 'delistLocalProduct'}('${p.id}')">${p.status === 'delisted' ? '重新上架' : '下架商品'}</a>`}
                <a href="#" class="action-link" onclick="deleteLocalProduct('${p.id}')" style="color: #ff4444;">删除商品</a>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
    
    // 更新分页控件
    updatePaginationControls(totalPages);
}

// 本地商品：查看/编辑（演示用）
function getLocalProducts() {
    return JSON.parse(localStorage.getItem('productListDraft') || '[]');
}

function setLocalProducts(list) {
    localStorage.setItem('productListDraft', JSON.stringify(list));
}

function openProductModal(title, html) {
    const modal = document.getElementById('product-modal');
    if (!modal) return;
    // 记录当前滚动位置，关闭时恢复
    try {
        modal.dataset.prevScrollTop = String(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0);
    } catch (e) {}
    document.getElementById('product-modal-title').textContent = title;
    document.getElementById('product-modal-body').innerHTML = html;
    modal.style.display = 'flex';
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.style.display = 'none';
        const top = Number(modal.dataset.prevScrollTop || 0);
        if (!Number.isNaN(top)) {
            window.scrollTo({ top });
        }
    }
}

window.closeProductModal = closeProductModal;

window.viewLocalProduct = function(id) {
    const list = getLocalProducts();
    const p = list.find(x => x.id === id);
    if (!p) {
        console.log('商品未找到:', id);
        return;
    }
    
    // 合并详情：优先读取 product:<id> 中的完整详情
    let full = {};
    try {
        full = JSON.parse(localStorage.getItem('product:' + id) || '{}');
    } catch (e) {}
    const merged = { ...p, ...full };
    
    const brand = merged.brandName || '-';
    const cate = merged.categoryText ? `${merged.categoryText.level1 || ''} / ${merged.categoryText.level2 || ''}` : '-';
    const mainImgs = (merged.mainImages && merged.mainImages.length ? merged.mainImages : (merged.formData?.mainImages || []));
    const detailImgs = (merged.detailImages && merged.detailImages.length ? merged.detailImages : (merged.formData?.detailImages || []));
    const galleryMain = mainImgs.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;">${mainImgs.map(s=>`<img src="${s}" style="width:120px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #eee;">`).join('')}</div>` : '';
    const galleryDetail = detailImgs.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;">${detailImgs.map(s=>`<img src="${s}" style="width:140px;height:140px;object-fit:cover;border-radius:6px;border:1px solid #eee;">`).join('')}</div>` : '';
    const html = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div class="form-group"><label>商品名称</label><div>${merged.name || ''}</div></div>
            <div class="form-group"><label>品牌</label><div>${brand}</div></div>
            <div class="form-group"><label>分类</label><div>${cate}</div></div>
            <div class="form-group"><label>价格</label><div>${merged.price || 0}</div></div>
            <div class="form-group"><label>库存</label><div>${merged.stock || 0}</div></div>
            <div class="form-group"><label>主图</label><div>${(mainImgs && mainImgs.length) ? galleryMain : '-'}</div></div>
            <div class="form-group"><label>详情图片</label><div>${(detailImgs && detailImgs.length) ? galleryDetail : '-'}</div></div>
            <div class="form-group"><label>详情</label><div style="max-height:320px;overflow:auto;border:1px solid #eee;padding:8px;">${merged.details || merged.productDetails || ''}</div></div>
        </div>
    `;
    openProductModal('查看商品', html);
};

window.editLocalProduct = function(id) {
    const list = getLocalProducts();
    const p = list.find(x => x.id === id);
    if (!p) return;
    // 跳转到新增/编辑模块并回填
    showProductModule('add-product');
    const form = document.getElementById('add-product-form');
    if (!form) return;
    // 尝试读取完整详情
    let full = {};
    try {
        full = JSON.parse(localStorage.getItem('product:' + id) || '{}');
    } catch (e) {}
    const merged = { ...p, ...full };
    
    // 基本字段回填
    const nameInput = document.getElementById('product-name');
    if (nameInput) nameInput.value = merged.name || '';
    const priceInput = form.querySelector('input[name="price"]');
    if (priceInput) priceInput.value = merged.price || 0;
    const stockInput = form.querySelector('input[name="stock"]');
    if (stockInput) stockInput.value = merged.stock || 0;
    
    // 详情字段回填（兼容不同字段名）
    const detailsTextarea = document.getElementById('product-details');
    const detailsValue = merged.details || merged.productDetails || '';
    if (detailsTextarea) detailsTextarea.value = detailsValue;
    const preview = document.getElementById('detail-preview-content');
    if (preview) preview.innerHTML = detailsValue || '<div class="preview-placeholder">请输入商品详情</div>';
    
    // 品牌回填
    const brandSelect = document.getElementById('product-brand');
    if (brandSelect && merged.brandName) {
        Array.from(brandSelect.options).forEach(opt => {
            if (opt.text === merged.brandName) opt.selected = true;
        });
    }
    
    // 分类回填
    if (merged.category && merged.category.level1) {
        const left = document.querySelector(`.category-item[data-category="${merged.category.level1}"]`);
        if (left) left.click();
        setTimeout(() => {
            const right = document.querySelector(`#subcategory-list .category-item[data-subcategory="${merged.category.level2}"]`);
            if (right) right.click();
        }, 30);
    }
    
    // 图片回填
    const mainArea = document.getElementById('main-images');
    const detailArea = document.getElementById('detail-images');
    if (mainArea) mainArea.innerHTML = '';
    if (detailArea) detailArea.innerHTML = '';
    (merged.mainImages || []).forEach(src => renderThumb(mainArea, src, () => {}));
    (merged.detailImages || []).forEach(src => renderThumb(detailArea, src, () => {}));
    
    // 更新计数
    const mainCount = document.getElementById('main-images-count');
    const detailCount = document.getElementById('detail-images-count');
    if (mainCount && mainArea) mainCount.textContent = `已上传 ${mainArea.querySelectorAll('.uploaded-image').length}/8`;
    if (detailCount && detailArea) detailCount.textContent = `已上传${detailArea.querySelectorAll('.uploaded-image').length}/8张`;
    
    // 标记正在编辑的商品ID
    form.setAttribute('data-editing-id', p.id);
};

// 编辑提交逻辑已集成到 bindSubmitProduct 中，无需重复处理

// 应用筛选条件
function applyFilters(list) {
    const productIdFilter = document.getElementById('product-id-filter')?.value || '';
    const productNameFilter = document.getElementById('product-name-filter')?.value || '';
    const brandNameFilter = document.getElementById('brand-name-filter')?.value || '';
    const categoryNameFilter = document.getElementById('category-name-filter')?.value || '';
    const statusFilter = document.getElementById('status-filter')?.value || '';
    
    return list.filter(product => {
        // 商品编号筛选
        if (productIdFilter && !product.id.toLowerCase().includes(productIdFilter.toLowerCase())) {
            return false;
        }
        
        // 商品名称筛选
        if (productNameFilter && !product.name.toLowerCase().includes(productNameFilter.toLowerCase())) {
            return false;
        }
        
        // 品牌名称筛选
        if (brandNameFilter && !product.brandName.toLowerCase().includes(brandNameFilter.toLowerCase())) {
            return false;
        }
        
        // 分类名称筛选
        if (categoryNameFilter) {
            const categoryText = product.categoryText ? 
                `${product.categoryText.level1 || ''} ${product.categoryText.level2 || ''}` : '';
            if (!categoryText.toLowerCase().includes(categoryNameFilter.toLowerCase())) {
                return false;
            }
        }
        
        // 状态筛选
        if (statusFilter) {
            if (statusFilter === 'on' && product.status !== 'active') return false;
            if (statusFilter === 'off' && product.status !== 'delisted') return false;
        }
        
        return true;
    });
}

// 更新商品统计信息
function updateProductStats(totalCount) {
    const countElement = document.getElementById('product-count');
    if (countElement) {
        countElement.textContent = `共 ${totalCount} 条`;
    }
}

// 更新分页控件
function updatePaginationControls(totalPages) {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageNumbers = document.getElementById('page-numbers');
    const paginationInfo = document.getElementById('pagination-info');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    
    if (paginationInfo) {
        paginationInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    }
    
    if (pageNumbers) {
        let html = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        }
        pageNumbers.innerHTML = html;
    }
}

// 切换页面
function changePage(direction) {
    const list = JSON.parse(localStorage.getItem('productListDraft') || '[]');
    const filteredList = applyFilters(list);
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);
    
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderProductListFromLocal();
    }
}

// 跳转到指定页面
function goToPage(page) {
    const list = JSON.parse(localStorage.getItem('productListDraft') || '[]');
    const filteredList = applyFilters(list);
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);
    
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderProductListFromLocal();
    }
}

// 更新批量删除按钮显示状态
function updateBatchDeleteButton() {
    const selectedCheckboxes = document.querySelectorAll('.product-select:checked');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    
    if (batchDeleteBtn) {
        batchDeleteBtn.style.display = selectedCheckboxes.length > 0 ? 'inline-block' : 'none';
    }
}

// 批量删除商品
window.batchDeleteProducts = function() {
    const selectedCheckboxes = document.querySelectorAll('.product-select:checked');
    if (selectedCheckboxes.length === 0) {
        alert('请先选择要删除的商品！');
        return;
    }
    
    if (!confirm(`确定要删除选中的 ${selectedCheckboxes.length} 个商品吗？删除后无法恢复！`)) {
        return;
    }
    
    const list = getLocalProducts();
    const selectedIds = Array.from(selectedCheckboxes).map(cb => {
        const productItem = cb.closest('.product-item');
        const actionLink = productItem.querySelector('.action-link[onclick*="deleteLocalProduct"]');
        const onclick = actionLink.getAttribute('onclick');
        const match = onclick.match(/deleteLocalProduct\('([^']+)'\)/);
        return match ? match[1] : null;
    }).filter(id => id);
    
    const filteredList = list.filter(product => !selectedIds.includes(product.id));
    setLocalProducts(filteredList);
    
    alert(`已删除 ${selectedIds.length} 个商品！`);
    renderProductListFromLocal();
    updateBatchDeleteButton();
};

// 下架商品
window.delistLocalProduct = function(id) {
    if (!confirm('确定要下架这个商品吗？')) return;
    
    const list = getLocalProducts();
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) {
        list[idx].status = 'delisted';
        list[idx].updatedAt = Date.now();
        setLocalProducts(list);
        alert('商品已下架！');
        renderProductListFromLocal();
    }
};

// 重新上架商品
window.relistLocalProduct = function(id) {
    if (!confirm('确定要重新上架这个商品吗？')) return;
    
    const list = getLocalProducts();
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) {
        list[idx].status = 'active';
        list[idx].updatedAt = Date.now();
        setLocalProducts(list);
        alert('商品已重新上架！');
        renderProductListFromLocal();
    }
};

// 删除商品
window.deleteLocalProduct = function(id) {
    if (!confirm('确定要删除这个商品吗？删除后无法恢复！')) return;
    
    const list = getLocalProducts();
    const filteredList = list.filter(x => x.id !== id);
    setLocalProducts(filteredList);
    alert('商品已删除！');
    renderProductListFromLocal();
};

function submitAddBrand() {
    const form = document.getElementById('add-brand-form');
    const formData = new FormData(form);
    
    const brandName = formData.get('brandName');
    const brandDescription = formData.get('brandDescription');
    const brandWebsite = formData.get('brandWebsite');
    const brandStatus = formData.get('brandStatus');
    
    if (!brandName) {
        alert('请输入品牌名称！');
        return;
    }
    
    // 创建新品牌对象
    const newBrand = {
        id: 'BR' + Date.now(),
        name: brandName,
        description: brandDescription || '暂无描述',
        website: brandWebsite || '',
        status: brandStatus,
        logo: document.querySelector('#logo-preview img').src || '',
        productCount: 0,
        sales: 0,
        rating: 0,
        createTime: new Date().toLocaleString('zh-CN')
    };
    
    // 添加到品牌列表
    addBrandToList(newBrand);
    // 写入本地存储
    const list = getLocalBrandList();
    list.unshift(newBrand);
    setLocalBrandList(list);
    
    // 更新品牌选择框
    loadBrandsToSelect();
    
    alert(`品牌创建成功！\n品牌名称: ${brandName}\n品牌描述: ${brandDescription}\n官方网站: ${brandWebsite}\n状态: ${brandStatus === 'active' ? '启用' : '禁用'}`);
    
    // 关闭模态框
    closeAddBrandModal();
}

// 添加品牌到列表
function addBrandToList(brand) {
    const brandsList = document.getElementById('brands-list');
    const brandItem = document.createElement('div');
    brandItem.className = 'brand-item';
    brandItem.innerHTML = `
        <div class="brand-checkbox">
            <input type="checkbox" class="brand-select">
        </div>
        <div class="brand-logo">
            <img src="${brand.logo || 'https://via.placeholder.com/60x60'}" alt="品牌Logo">
        </div>
        <div class="brand-info">
            <div class="brand-name">${brand.name}</div>
            <div class="brand-id">ID: ${brand.id}</div>
            <div class="brand-description">${brand.description}</div>
            <div class="brand-stats">
                <span class="stat-item">商品数: ${brand.productCount}</span>
                <span class="stat-item">销量: ${brand.sales}</span>
                <span class="stat-item">评分: ${brand.rating}</span>
            </div>
        </div>
        <div class="brand-status">
            <span class="status-badge ${brand.status === 'active' ? 'status-active' : 'status-inactive'}">${brand.status === 'active' ? '启用' : '禁用'}</span>
        </div>
        <div class="brand-time">
            <span>创建时间: ${brand.createTime}</span>
        </div>
        <div class="brand-actions">
            <a href="#" class="action-link">查看详情</a>
            <a href="#" class="action-link">修改品牌</a>
            <a href="#" class="action-link">${brand.status === 'active' ? '禁用品牌' : '启用品牌'}</a>
        </div>
    `;
    
    // 插入到列表顶部
    brandsList.insertBefore(brandItem, brandsList.firstChild);
    
    // 更新品牌数量
    updateBrandCount();
}

// 本地品牌存取
function getLocalBrandList() {
    try {
        return JSON.parse(localStorage.getItem('brandList') || '[]');
    } catch (e) {
        return [];
    }
}

function setLocalBrandList(list) {
    localStorage.setItem('brandList', JSON.stringify(list));
}

// 渲染本地品牌到页面
function renderBrandListFromLocal() {
    const brandsList = document.getElementById('brands-list');
    if (!brandsList) return;
    const brands = getLocalBrandList();
    if (!brands || brands.length === 0) return;
    brandsList.innerHTML = '';
    brands.forEach(b => addBrandToList(b));
}

// 更新品牌数量
function updateBrandCount() {
    const brandItems = document.querySelectorAll('.brand-item');
    const countElement = document.getElementById('brand-count');
    if (countElement) {
        countElement.textContent = `共 ${brandItems.length} 条`;
    }
}

// Logo上传功能
function initLogoUpload() {
    const logoPreview = document.getElementById('logo-preview');
    const fileInput = document.getElementById('brand-logo-file');
    if (!logoPreview || !fileInput) return;

    // 点击预览区域，触发文件选择
    logoPreview.addEventListener('click', function () {
        fileInput.click();
    });

    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = logoPreview.querySelector('img');
                    const placeholder = logoPreview.querySelector('.upload-placeholder');
                    
                    img.src = e.target.result;
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}
