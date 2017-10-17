"use strict"

const request = require('request-promise-native')
const co = require('co')

const API_DOMAIN = 'https://api.github.com'
const PAGE_LIMIT = 100

//const SINGLE_GIST_COMMITS_RESOURCE = `/gists/${gistId}/commits`
//const SINGLE_GIST_FORK_RESOURCE = `/gists/${gistId}/forks`

let GistClient = function () {

    this.setToken = (token) => {
        this.token = token
        return this
    }

    this.unsetToken = () => {
        this.token = null
        return this
    }

    this.getRevision = (gistId, versionSha) => {
        checkToken()
        return request(getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}/${versionSha}`))
    }

    this.getOneById = (gistId) => {
        checkToken()
        return request(getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}`))
    }

    this.getAll = (filterBy = []) => {
        return getList(getListConfiguredResource(filterBy))
    }

    this.star = (gistId) => {
        const config = getStarConfiguredResource(gistId)
        config.method = 'PUT'
        return starRequest(config)
    }

    this.unstar = (gistId) => {
        const config = getStarConfiguredResource(gistId)
        config.method = 'DELETE'
        return starRequest(config)
    }

    this.isStarred = (gistId) => {
        return starRequest(getStarConfiguredResource(gistId))
    }

    const checkToken = () => {
        if (!this.token)
            throw Error("You need to set token before by setToken() method")
    }

    const getBaseConfiguredResource = (resource) => {
        return {
            url    : resource,
            headers: {
                'Authorization': 'token ' + this.token,
                'User-Agent': 'GistClient'
            },
            json   : true,
            transform: includeHeadersTransformer
        }
    }

    const getListConfiguredResource = (filterBy = []) => {

        let resourceFilterCount = 0

        const getFilterValue = (filterName) => {
            const filter = filterBy.filter(filter => (filter[filterName]))
            return filter.length > 0 ? filter.pop()[filterName] : null
        }

        const getFilterValueAndCountResourceFilter = (filterName) => {
            const filterValue = getFilterValue(filterName)
            if (filterValue)
                resourceFilterCount++
            return filterValue
        }

        const sinceFilter = getFilterValue('since')
        const userNameFilter = getFilterValueAndCountResourceFilter('userName')
        const starredFilter = getFilterValueAndCountResourceFilter('starred')
        const publicFilter = getFilterValueAndCountResourceFilter('public')

        if (resourceFilterCount > 1)
            throw Error("You cannot combine this filters: userName, starred, public")

        let url = '/gists'
        if(userNameFilter)
            url = `/users/${userNameFilter}/gists`
        else {
            checkToken()
            if (true === starredFilter)
                url = '/gists/starred'
            else if (true === publicFilter)
                url = '/gists/public'
        }

        let resource = API_DOMAIN + url + `?per_page=${PAGE_LIMIT}`
        if(sinceFilter)
            resource += '&since=' + sinceFilter

        return getBaseConfiguredResource(resource)
    }

    const includeHeadersTransformer = (body, response) => {
        return {'headers': response.headers, 'data': body}
    }

    const getAllPaginatedResources = (responseHeaders) => {
        const links = {}
        responseHeaders.link.split(',').forEach((link) => {
            let rel = link.match(/; rel="(.*)"/)[1]
            links[rel] = link.match(/<(.*)>/)[1]
        })
        const pageCount = links.last.match(/\d+$/g)[0]
        const pages = []
        for(let i=0; i<pageCount; i++) {
            let pageUri = links.first.replace(/\d+$/g, `${i+1}`)
            pages.push(pageUri)
        }
        return pages
    }

    const getStarConfiguredResource = (gistId) => {
        return getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}/star`)
    }

    const starRequest = (resourceConfig) => {
        checkToken()
        return request(resourceConfig)
            .then(() => {
                return true
            }).catch(err => {
                if (404 === err.statusCode)
                    return false
                throw err
            })
    }

    const getList = (resourceConfig) => {
        return co(function *() {
            const page1Response = yield request(resourceConfig).then(res => { return res })
            let paginatedResources = getAllPaginatedResources(page1Response.headers)
            if (paginatedResources.length > 1) {
                paginatedResources.shift() //First element is removed to avoid repeat first page request
                const promises = []
                paginatedResources.forEach((uri) => {
                    promises.push(request(getBaseConfiguredResource(uri)))
                })
                return Promise.all(promises).then(function(results) {
                    results.unshift(page1Response)
                    const allResults = []
                    results.forEach(arrResult => {
                        arrResult.data.forEach(result => {
                            allResults.push(result)
                        })
                    })
                    return allResults
                })
            }
            return page1Response.data
        })
    }
}

module.exports = GistClient
module.exports.GistClient = GistClient
module.exports.default = GistClient
