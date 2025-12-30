const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3000;

// --- CONFIGURAÇÕES BÁSICAS ---
app.use(cors()); 
app.use(express.json()); 
app.use(express.static('public')); 

// --- CONFIGURAÇÃO DA SESSÃO ---
app.use(session({
    secret: 'chave-secreta-sistema-loja', // Pode manter assim por enquanto
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

// --- CONFIGURAÇÃO DE UPLOAD (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Garante que a pasta existe
        const dir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir); 
    },
    filename: (req, file, cb) => {
        const nomeLimpo = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
        cb(null, Date.now() + '-' + nomeLimpo);
    }
});
const upload = multer({ storage: storage });

// --- BANCO DE DADOS (ARQUIVOS JSON) ---
const ARQUIVO_PRODUTOS = path.join(__dirname, 'data', 'produtos.json');
const ARQUIVO_VENDAS = path.join(__dirname, 'data', 'vendas.json');
const ARQUIVO_CUPONS = path.join(__dirname, 'data', 'cupons.json');
const ARQUIVO_CONFIG = path.join(__dirname, 'data', 'loja-config.json'); 

// Função auxiliar para ler JSON (Segura contra arquivos vazios)
function lerJSON(arquivo) {
    // Cria o diretório 'data' se não existir
    const dir = path.dirname(arquivo);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(arquivo)) {
        const conteudoPadrao = arquivo.includes('config') ? '{}' : '[]';
        fs.writeFileSync(arquivo, conteudoPadrao);
    }
    const dados = fs.readFileSync(arquivo, 'utf8');
    try {
        return JSON.parse(dados || (arquivo.includes('config') ? '{}' : '[]'));
    } catch (e) {
        return (arquivo.includes('config') ? {} : []);
    }
}

// Função auxiliar para salvar JSON
function salvarJSON(arquivo, dados) {
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}

// ========================================================
// 🔐 ÁREA DE SEGURANÇA
// ========================================================

// 1. Rota de Login
app.post('/api/login', (req, res) => {
    const { senha } = req.body;
    // DICA: Em um projeto futuro, mova isso para um arquivo .env
    if (senha === 'admin123') { 
        req.session.usuarioLogado = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Senha incorreta' });
    }
});

// 2. Rota Protegida do Admin
app.get('/admin', (req, res) => {
    if (req.session.usuarioLogado) {
        res.sendFile(path.join(__dirname, 'private', 'admin.html'));
    } else {
        res.redirect('/login.html');
    }
});

// ========================================================
// 📊 DASHBOARD & ESTATÍSTICAS
// ========================================================

app.get('/api/dashboard', (req, res) => {
    try {
        const vendas = lerJSON(ARQUIVO_VENDAS);
        const produtos = lerJSON(ARQUIVO_PRODUTOS);

        const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // 1. Cálculos Gerais
        let faturamentoHoje = 0;
        let pendentes = 0;
        let totalVendasAprovadas = 0;
        let valorTotalAprovado = 0;

        // Mapa para o Gráfico (Últimos 7 dias)
        const vendasPorDia = {};
        
        // Inicializa os últimos 7 dias com 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dataStr = d.toISOString().split('T')[0];
            vendasPorDia[dataStr] = 0;
        }

        vendas.forEach(v => {
            // Tenta extrair a data YYYY-MM-DD (suporta ISO e localeString antigos)
            let dataVenda = '';
            try {
                if(v.data && v.data.includes('T')) dataVenda = v.data.split('T')[0];
                else if (v.data) {
                    // Tenta converter formato PT-BR antigo se houver
                    const parts = v.data.split(' ')[0].split('/'); 
                    if(parts.length === 3) dataVenda = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            } catch(e) {}

            if (v.status === 'Pendente') {
                pendentes++;
            } else if (v.status === 'Aprovado') {
                valorTotalAprovado += (parseFloat(v.total) || 0);
                totalVendasAprovadas++;

                // Soma para hoje
                if (dataVenda === hoje) {
                    faturamentoHoje += (parseFloat(v.total) || 0);
                }

                // Soma para o gráfico (se estiver no range dos 7 dias)
                if (vendasPorDia[dataVenda] !== undefined) {
                    vendasPorDia[dataVenda] += (parseFloat(v.total) || 0);
                }
            }
        });

        // Ticket Médio
        const ticketMedio = totalVendasAprovadas > 0 ? (valorTotalAprovado / totalVendasAprovadas) : 0;

        // Produtos com Baixo Estoque (< 5)
        const estoqueBaixo = [];
        produtos.forEach(p => {
            if(p.variacoes) {
                p.variacoes.forEach(v => {
                    if(v.estoque < 5) {
                        estoqueBaixo.push({
                            nome: p.nome,
                            marca: v.marca,
                            estoque: v.estoque
                        });
                    }
                });
            }
        });

        res.json({
            faturamentoHoje,
            pendentes,
            ticketMedio,
            estoqueBaixo,
            grafico: {
                labels: Object.keys(vendasPorDia), // Datas
                valores: Object.values(vendasPorDia) // Valores
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao calcular dashboard" });
    }
});

// ========================================================
// 📦 API DE PRODUTOS
// ========================================================

app.get('/api/produtos', (req, res) => {
    const produtos = lerJSON(ARQUIVO_PRODUTOS);
    res.json(produtos);
});

app.post('/api/produtos', upload.single('imagem'), (req, res) => {
    try {
        const produtos = lerJSON(ARQUIVO_PRODUTOS);
        
        let variacoes = [];
        if (typeof req.body.variacoes === 'string') {
            try { variacoes = JSON.parse(req.body.variacoes); } catch(e) { variacoes = []; }
        } else {
            variacoes = req.body.variacoes || [];
        }

        const novoProduto = {
            id: Date.now(),
            nome: req.body.nome,
            categoria: req.body.categoria,
            imagem: req.file ? `/uploads/${req.file.filename}` : '',
            variacoes: variacoes,
            ativo: true,
            // Preço base para exibição no card (pega o menor preço das variações ou 0)
            preco: variacoes.length > 0 ? Math.min(...variacoes.map(v => v.preco)) : 0
        };

        produtos.push(novoProduto);
        salvarJSON(ARQUIVO_PRODUTOS, produtos);
        res.json({ message: 'Produto cadastrado!', produto: novoProduto });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ error: "Erro interno" });
    }
});

app.put('/api/produtos/:id', upload.single('imagem'), (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let produtos = lerJSON(ARQUIVO_PRODUTOS);
        const index = produtos.findIndex(p => p.id === id);

        if (index === -1) return res.status(404).json({ message: "Produto não encontrado" });

        let variacoes = [];
        if (typeof req.body.variacoes === 'string') {
            try { variacoes = JSON.parse(req.body.variacoes); } catch(e) { variacoes = []; }
        } else {
            variacoes = req.body.variacoes || [];
        }

        const imagemFinal = req.file ? `/uploads/${req.file.filename}` : produtos[index].imagem;

        produtos[index] = {
            ...produtos[index],
            nome: req.body.nome,
            categoria: req.body.categoria,
            imagem: imagemFinal,
            variacoes: variacoes,
            preco: variacoes.length > 0 ? Math.min(...variacoes.map(v => v.preco)) : 0
        };

        salvarJSON(ARQUIVO_PRODUTOS, produtos);
        res.json({ message: 'Produto atualizado com sucesso!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ error: "Erro ao atualizar" });
    }
});

app.delete('/api/produtos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let produtos = lerJSON(ARQUIVO_PRODUTOS);
    const novaLista = produtos.filter(produto => produto.id !== id);
    salvarJSON(ARQUIVO_PRODUTOS, novaLista);
    res.json({ message: 'Produto deletado!' });
});

// ========================================================
// 🎟️ API DE CUPONS
// ========================================================

app.get('/api/cupons', (req, res) => {
    res.json(lerJSON(ARQUIVO_CUPONS));
});

app.post('/api/cupons', (req, res) => {
    const cupons = lerJSON(ARQUIVO_CUPONS);
    const { codigo, desconto } = req.body;
    
    if (cupons.find(c => c.codigo === codigo.toUpperCase())) {
        return res.status(400).json({ message: 'Código já existe' });
    }

    cupons.push({ codigo: codigo.toUpperCase(), desconto: parseInt(desconto) });
    salvarJSON(ARQUIVO_CUPONS, cupons);
    res.json({ message: 'Cupom criado' });
});

app.delete('/api/cupons/:codigo', (req, res) => {
    const codigo = req.params.codigo.toUpperCase();
    let cupons = lerJSON(ARQUIVO_CUPONS);
    const novaLista = cupons.filter(c => c.codigo !== codigo);
    salvarJSON(ARQUIVO_CUPONS, novaLista);
    res.json({ message: 'Cupom deletado' });
});

app.get('/api/cupom/:codigo', (req, res) => {
    const codigo = req.params.codigo.toUpperCase();
    const cupons = lerJSON(ARQUIVO_CUPONS);
    const cupom = cupons.find(c => c.codigo === codigo);

    if (cupom) {
        res.json({ valido: true, desconto: cupom.desconto });
    } else {
        res.json({ valido: false });
    }
});

// ========================================================
// 💰 VENDAS E ESTOQUE (ATUALIZADO E MELHORADO)
// ========================================================

app.get('/api/vendas', (req, res) => {
    const vendas = lerJSON(ARQUIVO_VENDAS);
    res.json(vendas.reverse());
});

// Rota POST principal melhorada (Compatível com o Passo 2)
app.post('/api/vendas', (req, res) => {
    try {
        const vendas = lerJSON(ARQUIVO_VENDAS);
        const corpo = req.body;

        // Validação: Front pode mandar 'produtos' ou 'itens'
        const listaProdutos = corpo.produtos || corpo.itens || [];

        if (!listaProdutos || listaProdutos.length === 0) {
            return res.status(400).json({ success: false, message: "O pedido está vazio." });
        }
        
        const novaVenda = {
            id_pedido: Date.now(),
            // Usa ISO string para facilitar ordenação e gráficos
            data: new Date().toISOString(), 
            cliente: corpo.cliente || 'Cliente do Site',
            produtos: listaProdutos, // Padroniza para 'produtos'
            total: corpo.total || 0,
            status: 'Pendente'
        };

        vendas.push(novaVenda);
        salvarJSON(ARQUIVO_VENDAS, vendas);
        
        console.log(`[VENDA] Novo pedido registrado: #${novaVenda.id_pedido} - Total: R$ ${novaVenda.total}`);
        res.json({ success: true, message: 'Pedido registrado!', id: novaVenda.id_pedido });

    } catch (err) {
        console.error("Erro ao salvar venda:", err);
        res.status(500).json({ success: false, message: "Erro interno no servidor ao salvar venda." });
    }
});

// Mantivemos a rota antiga caso algum legado use, redirecionando a lógica
app.post('/api/venda', (req, res) => {
    // Redireciona lógica para a rota principal
    req.url = '/api/vendas';
    app._router.handle(req, res);
});

app.post('/api/venda/:id/confirmar', (req, res) => {
    const idPedido = parseInt(req.params.id);
    
    let vendas = lerJSON(ARQUIVO_VENDAS);
    let produtos = lerJSON(ARQUIVO_PRODUTOS);
    
    const vendaIndex = vendas.findIndex(v => v.id_pedido === idPedido);
    
    if (vendaIndex === -1) return res.status(404).json({ message: 'Venda não encontrada' });
    if (vendas[vendaIndex].status === 'Aprovado') return res.status(400).json({ message: 'Venda já foi aprovada antes!' });

    // Lida com 'produtos' ou 'itens' (legado)
    const itensVenda = vendas[vendaIndex].produtos || vendas[vendaIndex].itens || [];
    let erros = [];

    // Baixa no estoque
    itensVenda.forEach(itemVenda => {
        // Procura produto pelo nome ou ID (se tiver)
        const produto = produtos.find(p => p.nome === itemVenda.name || p.nome === itemVenda.produto);
        
        if (produto && produto.variacoes) {
            // Tenta achar a variação
            const variacao = produto.variacoes.find(v => v.marca === itemVenda.marca || v.tamanho === itemVenda.tamanho);
            
            if (variacao) {
                const qtd = itemVenda.quantity || itemVenda.qtd || 1;
                if (variacao.estoque >= qtd) {
                    variacao.estoque -= qtd;
                } else {
                    erros.push(`Estoque insuficiente para ${produto.nome} - ${variacao.marca || variacao.tamanho}`);
                }
            }
        }
    });

    if (erros.length > 0) {
        return res.status(400).json({ message: 'Erro ao baixar estoque', detalhes: erros });
    }

    salvarJSON(ARQUIVO_PRODUTOS, produtos);
    vendas[vendaIndex].status = 'Aprovado';
    salvarJSON(ARQUIVO_VENDAS, vendas);

    res.json({ message: 'Venda confirmada e estoque atualizado com sucesso!' });
});

// 🔥 NOVA ROTA PARA RECUSAR PEDIDO (ADICIONADA)
app.post('/api/venda/:id/cancelar', (req, res) => {
    const idPedido = parseInt(req.params.id);
    let vendas = lerJSON(ARQUIVO_VENDAS);
    
    const vendaIndex = vendas.findIndex(v => v.id_pedido === idPedido);
    
    if (vendaIndex === -1) {
        return res.status(404).json({ message: 'Venda não encontrada' });
    }
    
    // Apenas altera o status para 'Cancelado'
    vendas[vendaIndex].status = 'Cancelado';
    salvarJSON(ARQUIVO_VENDAS, vendas);
    
    console.log(`[VENDA] Pedido #${idPedido} recusado pelo Admin.`);
    res.json({ message: 'Venda recusada com sucesso!' });
});

// ========================================================
// 🎨 CONFIGURAÇÕES DA LOJA
// ========================================================

app.get('/api/config', (req, res) => {
    try {
        const configData = lerJSON(ARQUIVO_CONFIG);
        res.json(configData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao carregar configurações' });
    }
});

// Configuração do Multer para aceitar múltiplos campos de arquivo
const configUpload = upload.fields([
    { name: 'fundoSite', maxCount: 1 },
    { name: 'fundoHeader', maxCount: 1 },
    { name: 'banner1', maxCount: 1 }, 
    { name: 'banner2', maxCount: 1 }, 
    { name: 'banner3', maxCount: 1 }  
]);

app.post('/api/config', configUpload, (req, res) => {
    try {
        let currentConfig = lerJSON(ARQUIVO_CONFIG);
        
        const novaConfig = {
            ...currentConfig, 
            ...req.body 
        };

        // Salva arquivos se forem enviados
        if (req.files['fundoSite']) novaConfig.fundoSite = req.files['fundoSite'][0].filename;
        if (req.files['fundoHeader']) novaConfig.fundoHeader = req.files['fundoHeader'][0].filename;
        
        // Salva Banners
        if (req.files['banner1']) novaConfig.banner1 = req.files['banner1'][0].filename;
        if (req.files['banner2']) novaConfig.banner2 = req.files['banner2'][0].filename;
        if (req.files['banner3']) novaConfig.banner3 = req.files['banner3'][0].filename;

        salvarJSON(ARQUIVO_CONFIG, novaConfig);
        
        res.json({ message: 'Loja atualizada com sucesso!', config: novaConfig });

    } catch (error) {
        console.error("Erro no POST /api/config:", error);
        res.status(500).json({ erro: 'Erro ao atualizar configurações' });
    }
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`✅ Sistema rodando em http://localhost:${PORT}`);
});