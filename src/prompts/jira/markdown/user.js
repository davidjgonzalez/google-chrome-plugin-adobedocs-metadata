{ 
    role: 'user'
    message: getMessage(params) {
        return `
        Use the following content to generate the appropriate values:


        { 
            title: ${params.title},
            description: ${params.description},
            ${params.version ? `version: ${params.version},` : ''}
            ${params.role && params.role.length ? `role: '${params.role.join(', ')}',` : ''}
            ${params.level && params.level.length ? `level: ${params.level.join(', ')},` : ''}
            content: ${params.content},
        
        
        }


        `
    }


}