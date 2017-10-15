"use strict"

const request = require('request-promise-native')
const co = require('co')

const API_DOMAIN = 'https://api.github.com'
const PAGE_LIMIT = 100

const AUTH_USER_ALL_GIST_RESOURCE = '/gists'
const AUTH_USER_PUBLIC_GIST_RESOURCE = '/gists/public'
const AUTH_USER_STARRED_GIST_RESOURCE = '/gists/starred'
//const GIVEN_USER_GIST_RESOURCE = `/user/${userId}/gists`
//const SINGLE_GIST_VERSION_RESOURCE = `/gists/${gistId}/${versionSha}`
//const SINGLE_GIST_COMMITS_RESOURCE = `/gists/${gistId}/commits`
//const SINGLE_GIST_STAR_RESOURCE = `/gists/${gistId}/star`
//const SINGLE_GIST_FORK_RESOURCE = `/gists/${gistId}/forks`

let GistClient = function () {

    this.token = null

    this.setToken = (token) => {
        this.token = token
        return this
    }

    this.unsetToken = () => {
        this.token = null
        return this
    }

    this.getOneById = (gistId) => {
        checkToken()
        return request(getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}`))
    }

    this.getAll = (filterBy = []) => {
        return co(function *() {
            const page1Response = yield request(getListConfiguredResource(filterBy)).then(res => { return res })
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

    const checkToken = () => {
        if (!this.token)
            throw "You need to set token before by setToken() method"
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

        const getFilterValue = (filterName) => {
            const filter = filterBy.filter(filter => (filter[filterName]))
            return filter.length > 0 ? filter.pop()[filterName] : null
        }

        const sinceFilter = getFilterValue('since')
        const userNameFilter = getFilterValue('userName')
        const starredFilter = getFilterValue('starred')
        const publicFilter = getFilterValue('public')

        if (filterBy.length > 2)
            throw "Only two filters allowed at same time"
        if (2 === filterBy.length && !sinceFilter)
            throw "You only can combine filters with 'since' filter"

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
}

module.exports = GistClient
module.exports.GistClient = GistClient
module.exports.default = GistClient
