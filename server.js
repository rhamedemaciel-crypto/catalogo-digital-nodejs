const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session'); // <--- ADICIONADO: Segurança

const app = express();
const PORT = 3000;

// --- CONFIGURAÇÕES BÁSICAS ---
app.use(cors()); 
app.use(express.json()); 
app.use(express.static('public')); 

// --- ADICIONADO: CONFIGURAÇÃO DA SESSÃO ---
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
const ARQUIVO_VENDAS = path.join(__dirname, 'data', 'vendas.json'); // Mantido!

function lerJSON(arquivo) {
    if (!fs.existsSync(arquivo)) {
        fs.writeFileSync(arquivo, '[]'); // Cria se não existir para evitar erro
    }
    const dados = fs.readFileSync(arquivo);
    return JSON.parse(dados || '[]');
}

function salvarJSON(arquivo, dados) {
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}

// ========================================================
// 🔐 ÁREA DE SEGURANÇA (NOVO)
// ========================================================

// 1. Rota de Login
app.post('/api/login', (req, res) => {
    const { senha } = req.body;
    if (senha === 'admin123') { // Defina sua senha aqui
        req.session.usuarioLogado = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Senha incorreta' });
    }
});

// 2. Rota Protegida do Admin
app.get('/admin', (req, res) => {
    if (req.session.usuarioLogado) {
        // Busca o arquivo na pasta 'private' (que o usuário não vê direto)
        res.sendFile(path.join(__dirname, 'private', 'admin.html'));
    } else {
        res.redirect('/login.html');
    }
});

// ========================================================
// 🛒 API DO SITE (Mantendo suas rotas)
// ========================================================

// 3. Rota para PEGAR produtos
app.get('/api/produtos', (req, res) => {
    const produtos = lerJSON(ARQUIVO_PRODUTOS);
    res.json(produtos);
});

// 4. Rota para CADASTRAR produto
app.post('/api/produtos', upload.single('imagem'), (req, res) => {
    try {
        const produtos = lerJSON(ARQUIVO_PRODUTOS);
        
        // Tratamento de variações vindo como string ou objeto
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

// 5. Rota para DELETAR produto
app.delete('/api/produtos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let produtos = lerJSON(ARQUIVO_PRODUTOS);
    const novaLista = produtos.filter(produto => produto.id !== id);
    salvarJSON(ARQUIVO_PRODUTOS, novaLista);
    res.json({ message: 'Produto deletado!' });
});

// 6. Rota para REGISTRAR VENDA (MANTIDA!)
app.post('/api/venda', (req, res) => {
    const vendas = lerJSON(ARQUIVO_VENDAS);
    const novaVenda = {
        id_pedido: Date.now(),
        data: new Date().toISOString(),
        cliente: req.body.cliente || 'Cliente Site',
        itens: req.body.itens,
        total: req.body.total,
        lucro_estimado: req.body.lucro_estimado || 0
    };

    vendas.push(novaVenda);
    salvarJSON(ARQUIVO_VENDAS, vendas);
    res.json({ message: 'Venda registrada!' });
});

// Iniciar
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});