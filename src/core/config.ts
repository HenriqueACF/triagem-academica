export const CONFIG = {
    crossrefBase: 'https://api.crossref.org',
    pubmedBase: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    dataciteBase: 'https://api.datacite.org',
    openalexBase: 'https://api.openalex.org',
    europepmcBase: 'https://www.ebi.ac.uk/europepmc/webservices/rest',

    mailto: 'hacfreitas@gmail.com',

    limiares:{
        tempoEdicaoCurtoMin:10,
        palavrasTempoCurto:1500,
        tempoEdicaoMuitoCurtoMin:30,
        palavrasTempoMuitoCurto:3000,

        revisoesBaixas:2,
        palavrasDocLongo:1000,

        janelaCriacaoModificacaoMin:15,

        rsidsMinimos:3,
        palavrasDocGrande:2000,

        artefatosMinOcorrencias:5,
        referenciaRecenteDias:90,

        editoresConhecidos:[
            'Microsoft Office Word',
            'Microsoft Word',
            'LibreOffice',
            'OpenOffice',
            'Google',
            'Pages',
        ]
    }
}
