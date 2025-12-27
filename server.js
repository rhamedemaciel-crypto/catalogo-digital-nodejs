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
    secret: 'segredo-super-secreto-do-catalogo',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

// --- CONFIGURAÇÃO DE UPLOAD (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'uploads')); 
    },
    filename: (req, file, cb) => {
        const nomeLimpo = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
        cb(null, Date.now() + '-' + nomeLimpo);
    }
});
const upload = multer({ storage: storage });

// --- BANCO DE DADOS ---
const ARQUIVO_PRODUTOS = path.join(__dirname, 'data', 'produtos.json');
const ARQUIVO_VENDAS = path.join(__dirname, 'data', 'vendas.json');
const ARQUIVO_CUPONS = path.join(__dirname, 'data', 'cupons.json');
const ARQUIVO_CONFIG = path.join(__dirname, 'data', 'loja-config.json'); // Caminho da config

function lerJSON(arquivo) {
    if (!fs.existsSync(arquivo)) {
        fs.writeFileSync(arquivo, '[]');
    }
    const dados = fs.readFileSync(arquivo);
    return JSON.parse(dados || '[]');
}

function salvarJSON(arquivo, dados) {
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}

// ========================================================
// 🔐 ÁREA DE SEGURANÇA
// ========================================================

// 1. Rota de Login
app.post('/api/login', (req, res) => {
    const { senha } = req.body;
    // IMPORTANTE: Mude 'admin123' para uma senha segura antes de entregar
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
// 📦 API DE PRODUTOS
// ========================================================

// Listar Produtos
app.get('/api/produtos', (req, res) => {
    const produtos = lerJSON(ARQUIVO_PRODUTOS);
    res.json(produtos);
});

// Cadastrar Produto (POST)
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
            ativo: true
        };

        produtos.push(novoProduto);
        salvarJSON(ARQUIVO_PRODUTOS, produtos);
        res.json({ message: 'Produto cadastrado!', produto: novoProduto });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ error: "Erro interno" });
    }
});

// Editar Produto (PUT)
app.put('/api/produtos/:id', upload.single('imagem'), (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let produtos = lerJSON(ARQUIVO_PRODUTOS);
        const index = produtos.findIndex(p => p.id === id);

        if (index === -1) return res.status(404).json({ message: "Produto não encontrado" });

        // Processar variações
        let variacoes = [];
        if (typeof req.body.variacoes === 'string') {
            try { variacoes = JSON.parse(req.body.variacoes); } catch(e) { variacoes = []; }
        } else {
            variacoes = req.body.variacoes || [];
        }

        // Mantém a imagem antiga se não enviou uma nova
        const imagemFinal = req.file ? `/uploads/${req.file.filename}` : produtos[index].imagem;

        // Atualiza os dados
        produtos[index] = {
            ...produtos[index], // Mantém ID e outros dados antigos
            nome: req.body.nome,
            categoria: req.body.categoria,
            imagem: imagemFinal,
            variacoes: variacoes
        };

        salvarJSON(ARQUIVO_PRODUTOS, produtos);
        res.json({ message: 'Produto atualizado com sucesso!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ error: "Erro ao atualizar" });
    }
});

// Deletar Produto Inteiro
app.delete('/api/produtos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let produtos = lerJSON(ARQUIVO_PRODUTOS);
    const novaLista = produtos.filter(produto => produto.id !== id);
    salvarJSON(ARQUIVO_PRODUTOS, novaLista);
    res.json({ message: 'Produto deletado!' });
});

// Deletar APENAS uma variação (Rota auxiliar, caso precise)
app.delete('/api/produtos/:id/variacao/:index', (req, res) => {
    const idProduto = parseInt(req.params.id);
    const indexVariacao = parseInt(req.params.index);
    
    let produtos = lerJSON(ARQUIVO_PRODUTOS);
    const produtoAlvo = produtos.find(p => p.id === idProduto);

    if (produtoAlvo) {
        produtoAlvo.variacoes.splice(indexVariacao, 1);
        salvarJSON(ARQUIVO_PRODUTOS, produtos);
        res.json({ message: 'Variação removida com sucesso!' });
    } else {
        res.status(404).json({ message: 'Produto não encontrado.' });
    }
});

// ========================================================
// 🎟️ API DE CUPONS
// ========================================================

// Listar Cupons
app.get('/api/cupons', (req, res) => {
    res.json(lerJSON(ARQUIVO_CUPONS));
});

// Criar Cupom
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

// Deletar Cupom
app.delete('/api/cupons/:codigo', (req, res) => {
    const codigo = req.params.codigo.toUpperCase();
    let cupons = lerJSON(ARQUIVO_CUPONS);
    const novaLista = cupons.filter(c => c.codigo !== codigo);
    salvarJSON(ARQUIVO_CUPONS, novaLista);
    res.json({ message: 'Cupom deletado' });
});

// Validar Cupom
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
// 💰 VENDAS E ESTOQUE
// ========================================================

// Listar Vendas
app.get('/api/vendas', (req, res) => {
    const vendas = lerJSON(ARQUIVO_VENDAS);
    res.json(vendas.reverse());
});

// Registrar Nova Venda
app.post('/api/venda', (req, res) => {
    const vendas = lerJSON(ARQUIVO_VENDAS);
    
    const novaVenda = {
        id_pedido: Date.now(),
        data: new Date().toLocaleString('pt-BR'),
        cliente: req.body.cliente || 'Cliente Site',
        itens: req.body.itens,
        total: req.body.total,
        status: 'Pendente'
    };

    vendas.push(novaVenda);
    salvarJSON(ARQUIVO_VENDAS, vendas);
    
    res.json({ message: 'Pedido registrado!', id: novaVenda.id_pedido });
});

// Confirmar Venda
app.post('/api/venda/:id/confirmar', (req, res) => {
    const idPedido = parseInt(req.params.id);
    
    let vendas = lerJSON(ARQUIVO_VENDAS);
    let produtos = lerJSON(ARQUIVO_PRODUTOS);
    
    const vendaIndex = vendas.findIndex(v => v.id_pedido === idPedido);
    
    if (vendaIndex === -1) return res.status(404).json({ message: 'Venda não encontrada' });
    if (vendas[vendaIndex].status === 'Aprovado') return res.status(400).json({ message: 'Venda já foi aprovada antes!' });

    const itensVenda = vendas[vendaIndex].itens;
    let erros = [];

    itensVenda.forEach(itemVenda => {
        const produto = produtos.find(p => p.nome === itemVenda.produto);
        
        if (produto) {
            const variacao = produto.variacoes.find(v => v.marca === itemVenda.marca);
            
            if (variacao) {
                if (variacao.estoque >= itemVenda.qtd) {
                    variacao.estoque -= itemVenda.qtd;
                } else {
                    erros.push(`Estoque insuficiente para ${itemVenda.produto} (${itemVenda.marca})`);
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

// ========================================================
// 🎨 CONFIGURAÇÕES DA LOJA (PERSONALIZAÇÃO)
// ========================================================

/* ROTA PARA LER A CONFIGURAÇÃO */
app.get('/config', (req, res) => {
    try {
        if (!fs.existsSync(ARQUIVO_CONFIG)) {
            // Cria um arquivo padrão se não existir
            fs.writeFileSync(ARQUIVO_CONFIG, JSON.stringify({ nomeLoja: "Minha Loja" }));
        }
        const configData = fs.readFileSync(ARQUIVO_CONFIG);
        res.json(JSON.parse(configData));
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao carregar configurações' });
    }
});

/* ROTA PARA ATUALIZAR A CONFIGURAÇÃO (CORRIGIDA) */
// Aceita campos de texto E arquivos
app.post('/config', upload.fields([{ name: 'fundoSite' }, { name: 'fundoHeader' }]), (req, res) => {
    try {
        // 1. Ler a configuração atual
        let currentConfig = {};
        if (fs.existsSync(ARQUIVO_CONFIG)) {
            currentConfig = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG));
        }
        
        // 2. CORREÇÃO: Atualizar com TUDO que veio no corpo da requisição (req.body)
        // Isso garante que whatsappPedidos, instagramLink, etc sejam salvos.
        const novaConfig = {
            ...currentConfig, // Mantém o que já existia
            ...req.body       // Sobrescreve com os novos textos enviados pelo form
        };

        // 3. Se enviou imagem nova para o FUNDO do site, atualiza
        if (req.files['fundoSite']) {
            novaConfig.fundoSite = req.files['fundoSite'][0].filename;
        }

        // 4. Se enviou imagem nova para o HEADER, atualiza
        if (req.files['fundoHeader']) {
            novaConfig.fundoHeader = req.files['fundoHeader'][0].filename;
        }

        // 5. Salvar no arquivo JSON
        salvarJSON(ARQUIVO_CONFIG, novaConfig);
        
        res.json({ message: 'Loja atualizada com sucesso!', config: novaConfig });

    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar configurações' });
    }
});

// Iniciar
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});