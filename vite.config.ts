import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// Expõe a versão do package.json como constante global no bundle, para
// que o rodapé e os relatórios possam exibir de qual versão da
// ferramenta eles vieram — sem duplicar o número em outro arquivo.
export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
})
