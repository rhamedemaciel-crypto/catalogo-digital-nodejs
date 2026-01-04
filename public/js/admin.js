// ==========================================
// 0. CONFIGURAÇÕES & NAVEGAÇÃO
// ==========================================
const API_URL = ""; 

// 🔥 CORREÇÃO: Definimos a função ANTES do carregamento da página
window.openTab = function(aba) {
    console.log("Navegando para:", aba);

    // 1. Esconde todas as seções
    const secoes = document.querySelectorAll('section, .tab-content');
    secoes.forEach(s => s.style.display = 'none');

    // 2. Remove classe ativo dos botões
    const botoes = document.querySelectorAll('.btn-nav');
    botoes.forEach(b => b.classList.remove('ativo'));

    // 3. Mostra a aba certa
    let abaAlvo = document.getElementById(aba);
    if (!abaAlvo) abaAlvo = document.getElementById('aba-' + aba);
    
    if (abaAlvo) {
        abaAlvo.style.display = 'block';
        abaAlvo.classList.add('active'); 
    }

    // 4. Ativa o botão no menu
    const btnAlvo = document.getElementById('nav-' + aba) || document.querySelector(`button[onclick*="'${aba}'"]`);
    if(btnAlvo) btnAlvo.classList.add('ativo');

    // 5. Carrega dados específicos (Com proteção de erro)
    try {
        if (aba === 'dashboard') carregarDashboard();
        if (aba === 'pedidos') carregarVendas();
        if (aba === 'produtos') carregarListaAdmin();
        if (aba === 'revendedores') carregarRevendedores();
        if (aba === 'config' || aba === 'social') carregarConfiguracoesNoForm();
    } catch (e) {
        console.error("Erro ao carregar aba:", e);
    }
};

window.mostrarAba = window.openTab;

window.logout = function() {
    window.location.href = '/logout';
};

window.toggleAdminMenu = function() {
    const sidebar = document.getElementById('sidebarAdmin');
    const overlay = document.getElementById('overlayAdmin');
    if (sidebar) sidebar.classList.toggle('aberto');
    if (overlay) overlay.classList.toggle('aberto');
};

// ==========================================
// 1. INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin JS Iniciado com sucesso ✅");

    try { carregarDashboard(); } catch(e) { console.warn("Dash offline no inicio", e); }
    
    // Inicializa a primeira linha de variação visual
    const containerVars = document.getElementById('container-variacoes');
    if (containerVars) adicionarLinhaVariacao();

    carregarVendas();
    carregarListaAdmin();
    carregarCupons();
    
    const addListener = (id, func) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('submit', func);
    };

    addListener('form-tema', salvarConfigGeneric);
    addListener('form-social', salvarConfigGeneric);
    addListener('form-config', salvarConfigGeneric);
    addListener('form-produto', salvarProduto);
    addListener('form-cupom', salvarCupom);
    addListener('form-revendedor', salvarRevendedor);

    openTab('dashboard');
});

// ==========================================
// 2. DASHBOARD & RELATÓRIOS
// ==========================================
let chartInstance = null; 

async function carregarDashboard() {
    try {
        const elPeriodo = document.getElementById('filtro-periodo');
        const periodo = elPeriodo ? elPeriodo.value : '7dias';
        
        const res = await fetch(`${API_URL}/api/vendas`);
        const todasVendas = await res.json();
        
        const resDash = await fetch(`${API_URL}/api/dashboard`);
        const dataDash = await resDash.json();

        const hoje = new Date();
        let faturamento = 0;
        let pendentes = 0;
        let aprovados = 0;
        let ticketSoma = 0;
        
        const vendasFiltradas = todasVendas.filter(v => {
            if (v.status === 'Pendente') pendentes++; 
            if (v.status !== 'Aprovado') return false;

            const dataVenda = new Date(v.data);
            const diffTime = Math.abs(hoje - dataVenda);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            if (periodo === 'hoje') return diffDays <= 1;
            if (periodo === '7dias') return diffDays <= 7;
            if (periodo === '30dias') return diffDays <= 30;
            return true;
        });

        vendasFiltradas.forEach(v => {
            const val = parseFloat(v.total) || 0;
            faturamento += val;
            aprovados++;
            ticketSoma += val;
        });

        const ticketMedio = aprovados > 0 ? ticketSoma / aprovados : 0;

        const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        
        setTxt('dash-faturamento', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamento));
        setTxt('dash-pendentes', pendentes);
        setTxt('dash-vendas-qtd', aprovados);
        setTxt('dash-ticket', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticketMedio));

        if(dataDash.grafico) renderizarGrafico(dataDash.grafico.labels, dataDash.grafico.valores);

        // Alerta de Estoque Baixo
        const divEstoque = document.getElementById('card-estoque-baixo');
        const listaEstoque = document.getElementById('lista-estoque-baixo');
        
        if (listaEstoque && dataDash.estoqueBaixo) {
            listaEstoque.innerHTML = '';
            if (dataDash.estoqueBaixo.length > 0) {
                if(divEstoque) divEstoque.style.display = 'block';
                dataDash.estoqueBaixo.forEach(item => {
                    listaEstoque.innerHTML += `
                        <div style="background:#330000; color:#ffaaaa; padding:8px; margin-bottom:5px; border-left:3px solid red; border-radius:4px; font-size:0.9em;">
                            <b>${item.nome}</b> (${item.marca}): ${item.estoque} un.
                        </div>`;
                });
            } else {
                listaEstoque.innerHTML = '<p style="color:#00ff88; padding:5px;">Estoque saudável! ✅</p>';
            }
        }

    } catch (error) {
        console.error("Erro dashboard:", error);
    }
}

function renderizarGrafico(labels, valores) {
    const ctxElement = document.getElementById('graficoVendas');
    if(!ctxElement) return;
    
    const ctx = ctxElement.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labelsFmt = labels.map(d => d.split('-').slice(1).reverse().join('/'));

    chartInstance = new Chart(ctx, {
        type: 'line', 
        data: {
            labels: labelsFmt,
            datasets: [{
                label: 'Vendas (R$)',
                data: valores,
                borderColor: '#ff5e00',
                backgroundColor: 'rgba(255, 94, 0, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }, 
            scales: {
                y: { beginAtZero: true, grid: { color: '#222' }, ticks: { color: '#666' } },
                x: { grid: { display: false }, ticks: { color: '#666' } }
            }
        }
    });
}

// ==========================================
// 3. PRODUTOS & VARIAÇÕES (COM BLOCOS VISUAIS)
// ==========================================

// Função que CRIA os blocos na tela (O "Jeito Antigo" Restaurado)
window.adicionarLinhaVariacao = function(dados = {}) {
    const container = document.getElementById('container-variacoes');
    if (!container) return; 

    const div = document.createElement('div');
    div.className = 'variacao-row'; 
    // Estilo inline para garantir aparência de bloco separado
    div.style.cssText = "background: #1a1a1a; padding: 15px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #333;";
    
    div.innerHTML = `
        <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:0.8em; color:#888;">Descrição da Opção (Marca/Tamanho)</label>
            <input type="text" placeholder="Ex: Tamanho G, Azul, 110v" class="var-marca" value="${dados.marca || dados.tamanho || ''}" required style="width:100%; padding:10px; background:#000; border:1px solid #444; color:white; border-radius:4px;">
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:1;">
                <label style="font-size:0.8em; color:#888;">Preço (R$)</label>
                <input type="number" placeholder="0.00" class="var-preco" value="${dados.preco_venda || dados.preco || ''}" step="0.01" required style="width:100%; padding:10px; background:#000; border:1px solid #444; color:white; border-radius:4px;">
            </div>
            <div style="flex:1;">
                <label style="font-size:0.8em; color:#888;">Estoque (Qtd)</label>
                <input type="number" placeholder="0" class="var-estoque" value="${dados.estoque !== undefined ? dados.estoque : ''}" required style="width:100%; padding:10px; background:#000; border:1px solid #444; color:white; border-radius:4px;">
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()" style="margin-top:10px; width:100%; border:1px solid #ff4444; background:transparent; color:#ff4444; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;">
            <i class="fas fa-trash"></i> Remover esta Opção
        </button>
    `;
    container.appendChild(div);
};

async function salvarProduto(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const idEdicao = document.getElementById('id-produto-editando').value;

    // 1. Varre os blocos visuais e monta o array
    const variacoes = [];
    document.querySelectorAll('.variacao-row').forEach(row => {
        variacoes.push({
            marca: row.querySelector('.var-marca').value,
            preco: parseFloat(row.querySelector('.var-preco').value) || 0,
            estoque: parseInt(row.querySelector('.var-estoque').value) || 0
        });
    });

    // 2. Coloca o array convertido em String no FormData para o backend ler
    if (variacoes.length > 0) {
        formData.set('variacoes', JSON.stringify(variacoes));
    } else {
        // Se não tiver blocos, tenta limpar ou usar fallback
        formData.set('variacoes', '[]');
    }

    try {
        let url = `${API_URL}/api/produtos`;
        let method = 'POST';
        if(idEdicao) {
            url += `/${idEdicao}`;
            method = 'PUT';
        }

        const res = await fetch(url, { method, body: formData });
        if(res.ok) {
            alert('Produto salvo com sucesso!');
            cancelarEdicao();
            carregarListaAdmin();
        } else {
            const err = await res.json();
            alert('Erro: ' + (err.error || err.message));
        }
    } catch(e) { console.error(e); alert('Erro de conexão ao salvar produto'); }
}

window.prepararEdicao = function(id) {
    const produto = window.todosProdutos?.find(p => p.id == id || p._id == id);
    if(produto) {
        iniciarEdicao(produto);
        openTab('produtos');
    }
};

function iniciarEdicao(produto) {
    const form = document.getElementById('form-produto');
    if(!form) return;

    document.getElementById('id-produto-editando').value = produto._id || produto.id;
    if(form.nome) form.nome.value = produto.nome;
    if(form.categoria) form.categoria.value = produto.categoria;
    if(form.preco) form.preco.value = produto.preco;

    // Limpa e recria os blocos visuais
    const container = document.getElementById('container-variacoes');
    if(container) {
        container.innerHTML = '';
        if(produto.variacoes && Array.isArray(produto.variacoes) && produto.variacoes.length > 0) {
            produto.variacoes.forEach(v => adicionarLinhaVariacao(v));
        } else {
            adicionarLinhaVariacao(); // Adiciona um vazio se não tiver nada
        }
    }

    const btn = form.querySelector('button[type="submit"]');
    if(btn) { btn.innerText = "ATUALIZAR PRODUTO"; btn.style.background = "#9d00ff"; }
    
    const btnCancel = document.getElementById('btn-cancelar');
    if(btnCancel) btnCancel.style.display = 'block';
    
    form.scrollIntoView({ behavior: 'smooth' });
}

window.cancelarEdicao = function() {
    const form = document.getElementById('form-produto');
    if(!form) return;
    form.reset();
    document.getElementById('id-produto-editando').value = '';
    
    const container = document.getElementById('container-variacoes');
    if(container) { 
        container.innerHTML = ''; 
        adicionarLinhaVariacao(); // Volta para o estado inicial (1 linha vazia)
    }

    const btn = form.querySelector('button[type="submit"]');
    if(btn) { btn.innerText = "SALVAR PRODUTO"; btn.style.background = ""; }
    
    const btnCancel = document.getElementById('btn-cancelar');
    if(btnCancel) btnCancel.style.display = 'none';
};

window.deletarProduto = async function(id) {
    if(confirm('Excluir produto permanentemente?')) {
        await fetch(`${API_URL}/api/produtos/${id}`, { method: 'DELETE' });
        carregarListaAdmin();
        carregarDashboard();
    }
};

async function carregarListaAdmin() {
    const container = document.getElementById('lista-produtos-admin');
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/produtos`);
        const produtos = await res.json();
        window.todosProdutos = produtos; 

        container.innerHTML = produtos.map(p => `
            <div style="background:#1a1a1a; padding:10px; margin-bottom:5px; border-radius:5px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${p.imagem || ''}" style="width:40px; height:40px; border-radius:4px; object-fit:cover; background:#333;">
                    <div>
                        <div style="font-weight:bold; color:white;">${p.nome}</div>
                        <div style="font-size:0.8em; color:#888;">${p.variacoes ? p.variacoes.length + ' opções' : 'Único'}</div>
                    </div>
                </div>
                <div>
                    <button onclick="prepararEdicao('${p._id || p.id}')" style="background:none; border:1px solid #ffcc00; color:#ffcc00; border-radius:4px; cursor:pointer; margin-right:5px;">✏️</button>
                    <button onclick="deletarProduto('${p._id || p.id}')" style="background:none; border:1px solid #ff4444; color:#ff4444; border-radius:4px; cursor:pointer;">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch(e) { console.error("Erro lista produtos", e); }
}

// ==========================================
// 4. VENDAS
// ==========================================
let todasAsVendasCache = []; 

async function carregarVendas() {
    const tbody = document.getElementById('tabela-vendas'); 
    const divLista = document.getElementById('lista-vendas'); 
    
    try {
        const res = await fetch(`${API_URL}/api/vendas`);
        const vendas = await res.json();
        todasAsVendasCache = vendas;

        const renderRows = (lista) => lista.map(v => {
            const badgeClass = v.status === 'Aprovado' ? 'badge-aprovado' : (v.status === 'Cancelado' ? 'badge-cancelado' : 'badge-pendente');
            const statusColor = v.status === 'Aprovado' ? '#00cc66' : (v.status === 'Pendente' ? '#ffaa00' : '#ff4444');
            
            const acoes = v.status === 'Pendente' ? `
                <button onclick="confirmarVenda('${v._id || v.id_pedido}')" class="btn-action btn-approve" style="background:#00cc66; color:white; border:none; padding:5px 10px; cursor:pointer; margin-right:5px; border-radius:4px;">✔</button>
                <button onclick="cancelarVenda('${v._id || v.id_pedido}')" class="btn-action btn-cancel" style="background:#ff4444; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px;">✖</button>
            ` : '-';

            return `<tr>
                <td style="color:#aaa;">#${String(v.id_pedido || v._id).slice(-4)}</td>
                <td>${v.cliente.nome || v.cliente}</td>
                <td style="color:cyan">${v.representante ? v.representante : '-'}</td>
                <td style="font-weight:bold;">R$ ${parseFloat(v.total).toFixed(2)}</td>
                <td><span class="badge ${badgeClass}" style="padding:2px 6px; border-radius:4px; background:${statusColor}; color:${v.status==='Pendente'?'black':'white'}">${v.status}</span></td>
                <td>${acoes}</td>
            </tr>`;
        }).join('');

        if (tbody) tbody.innerHTML = vendas.length ? renderRows(vendas) : '<tr><td colspan="6">Sem pedidos.</td></tr>';
        else if (divLista) divLista.innerHTML = vendas.length ? renderRows(vendas) : 'Sem pedidos.';

    } catch (e) { console.error("Erro vendas", e); }
}

window.confirmarVenda = async function(id) {
    if(!confirm('Aprovar pedido? O estoque será atualizado automaticamente.')) return;
    try {
        const res = await fetch(`${API_URL}/api/venda/${id}/confirmar`, { method: 'POST' });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            carregarVendas();
            carregarDashboard();
        } else {
            alert('Erro: ' + data.message);
        }
    } catch(e) { alert('Erro de conexão'); }
};

window.cancelarVenda = async function(id) {
    if(!confirm('Recusar este pedido?')) return;
    await fetch(`${API_URL}/api/venda/${id}/cancelar`, { method: 'POST' });
    carregarVendas();
};

window.filtrarPedidos = function(filtro) {
    const tbody = document.getElementById('tabela-vendas');
    const divLista = document.getElementById('lista-vendas');
    
    let filtradas = todasAsVendasCache;
    if (filtro !== 'todos') {
        filtradas = todasAsVendasCache.filter(v => v.status === filtro);
    }

    // Reutiliza a lógica de renderização
    const renderRows = (lista) => lista.map(v => {
        const badgeClass = v.status === 'Aprovado' ? 'badge-aprovado' : (v.status === 'Cancelado' ? 'badge-cancelado' : 'badge-pendente');
        const statusColor = v.status === 'Aprovado' ? '#00cc66' : (v.status === 'Pendente' ? '#ffaa00' : '#ff4444');
        return `<tr>
            <td>#${String(v.id_pedido || v._id).slice(-4)}</td>
            <td>${v.cliente.nome || v.cliente}</td>
            <td>${v.representante || '-'}</td>
            <td>R$ ${parseFloat(v.total).toFixed(2)}</td>
            <td><span style="background:${statusColor}; padding:2px 6px; border-radius:4px; color:${v.status==='Pendente'?'black':'white'}">${v.status}</span></td>
            <td>-</td>
        </tr>`;
    }).join('');

    if (tbody) {
        tbody.innerHTML = filtradas.length ? renderRows(filtradas) : '<tr><td colspan="6">Vazio</td></tr>';
    } else if (divLista) {
        divLista.innerHTML = filtradas.length ? filtradas.map(v => renderVendaCard(v)).join('') : 'Vazio';
    }
};

// ==========================================
// 5. REVENDEDORES (NOVO SISTEMA)
// ==========================================
async function carregarRevendedores() {
    const tbody = document.getElementById('tabela-revendedores');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/api/revendedores`);
        const reps = await res.json();
        
        tbody.innerHTML = reps.map(r => `
            <tr>
                <td style="color:white;">${r.nome}</td>
                <td>
                    <span style="background:#222; color:#00ff88; padding:2px 5px; font-family:monospace; border-radius:3px;">?ref=${r.slug}</span>
                    <button onclick="copiarLink('${r.slug}')" style="border:none; background:none; cursor:pointer; font-size:1.2em; color:cyan; margin-left:5px;">📋</button>
                </td>
                <td style="color:#aaa;">${r.whatsapp || '-'}</td>
                <td><button style="color:red; background:none; border:none; cursor:pointer; opacity:0.5;">Bloquear</button></td>
            </tr>
        `).join('');
    } catch (e) { console.error("Erro reps", e); }
}

async function salvarRevendedor(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch(`${API_URL}/api/revendedores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if(result.success) {
            alert('Revendedor cadastrado com sucesso!');
            e.target.reset();
            carregarRevendedores();
        } else {
            alert('Erro: ' + (result.error || 'Falha ao criar'));
        }
    } catch(err) { console.error(err); alert('Erro de conexão'); }
}

window.copiarLink = function(slug) {
    const url = `${window.location.origin}/?ref=${slug}`;
    navigator.clipboard.writeText(url).then(() => {
        alert('Link copiado: ' + url);
    });
};

// ==========================================
// 6. CONFIGURAÇÕES & CUPONS
// ==========================================
async function carregarConfiguracoesNoForm() {
    try {
        const res = await fetch(`${API_URL}/api/config`);
        const conf = await res.json();
        
        if(document.getElementById('config-nome')) document.getElementById('config-nome').value = conf.nomeLoja || '';
        if(document.getElementById('config-cor')) document.getElementById('config-cor').value = conf.corDestaque || '#ff6600';
        if(document.getElementById('social-zap-pedidos')) document.getElementById('social-zap-pedidos').value = conf.whatsapp || '';
        
        // Carrega cupons aqui
        carregarCupons();
    } catch(e) {}
}

async function salvarConfigGeneric(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn ? btn.innerText : 'Salvar';
    if(btn) { btn.innerText = "Salvando..."; btn.disabled = true; }

    try {
        await fetch(`${API_URL}/api/config`, { method: 'POST', body: new FormData(e.target) });
        alert('Configurações salvas!');
    } catch (error) {
        alert('Erro ao salvar.');
    } finally {
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    }
}

async function carregarCupons() {
    const div = document.getElementById('lista-cupons');
    if(!div) return;
    try {
        const res = await fetch(`${API_URL}/api/cupons`);
        const lista = await res.json();
        div.innerHTML = lista.map(c => `
            <div style="background:#1a1a1a; padding:10px; margin-bottom:5px; border-radius:4px; display:flex; justify-content:space-between; border:1px solid #333;">
                <span style="color:white;"><b>${c.codigo}</b> (${c.desconto}%)</span>
                <button onclick="deletarCupom('${c.codigo}')" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        `).join('');
    } catch(e){}
}

async function salvarCupom(e) {
    e.preventDefault();
    const codigo = document.getElementById('cupom-codigo').value;
    const desconto = document.getElementById('cupom-valor').value;
    
    await fetch(`${API_URL}/api/cupons`, { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ codigo, desconto }) 
    });
    alert('Cupom criado!');
    carregarCupons();
    e.target.reset();
}

window.deletarCupom = async function(cod) {
    if(confirm('Excluir cupom?')) {
        await fetch(`${API_URL}/api/cupons/${cod}`, { method: 'DELETE' });
        carregarCupons();
    }
};