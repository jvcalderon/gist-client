"use strict"

const request = require('request-promise-native')
const co = require('co')

const API_DOMAIN = 'https://api.github.com'
const PAGE_LIMIT = 100

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
        _checkToken()
        return request(_getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}/${versionSha}`))
    }

    this.getOneById = (gistId) => {
        _checkToken()
        return request(_getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}`))
    }

    this.getAll = (filterBy = []) => {
        return _getList(_getListConfiguredResource(filterBy), filterBy)
    }

    this.getCommits = (gistId, filterBy = []) => {
        _checkToken()
        const url = `/gists/${gistId}/commits`
        return _getList((_getListConfiguredResource(filterBy, url)), filterBy)
    }

    this.getForks = (gistId, filterBy = []) => {
        _checkToken()
        const url = `/gists/${gistId}/forks`
        return _getList((_getListConfiguredResource(filterBy, url)), filterBy)
    }

    this.star = (gistId) => {
        const config = _getStarConfiguredResource(gistId)
        config.method = 'PUT'
        return _noContentRequest(config)
    }

    this.unstar = (gistId) => {
        const config = _getStarConfiguredResource(gistId)
        config.method = 'DELETE'
        return _noContentRequest(config)
    }

    this.isStarred = (gistId) => {
        return _noContentRequest(_getStarConfiguredResource(gistId))
    }

    this.create = (data) => {
        _checkToken()
        const config = _getBaseConfiguredResource(API_DOMAIN + `/gists`)
        config.method = 'POST'
        config.json = data
        return request(config)
    }

    this.update = (gistId, data) => {
        _checkToken()
        const config = _getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}`)
        config.method = 'PATCH'
        config.json = data
        return request(config)
    }

    this.delete = (gistId) => {
        _checkToken()
        const config = _getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}`)
        config.method = 'DELETE'
        return _noContentRequest(config)
    }

    const _checkToken = () => {
        if (!this.token)
            throw Error("You need to set token before by setToken() method")
    }

    const _getBaseConfiguredResource = (resource) => {
        return {
            url      : resource,
            headers  : {
                'Authorization': 'token ' + this.token,
                'User-Agent'   : 'GistClient'
            },
            json     : true,
            transform: _includeHeadersTransformer
        }
    }

    const _getListConfiguredResource = (filterBy = [], url = null) => {

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

        if (!url) {
            const userNameFilter = getFilterValueAndCountResourceFilter('userName')
            const starredFilter = getFilterValueAndCountResourceFilter('starred')
            const publicFilter = getFilterValueAndCountResourceFilter('public')

            if (resourceFilterCount > 1)
                throw Error("You cannot combine this filters: userName, starred, public")

            url = '/gists'
            if (userNameFilter)
                url = `/users/${userNameFilter}/gists`
            else {
                _checkToken()
                if (true === starredFilter)
                    url = '/gists/starred'
                else if (true === publicFilter)
                    url = '/gists/public'
            }
        }

        let resource = API_DOMAIN + url + `?per_page=${PAGE_LIMIT}`
        if (sinceFilter)
            resource += '&since=' + sinceFilter

        return _getBaseConfiguredResource(resource)
    }

    const _includeHeadersTransformer = (body, response) => {
        return {'headers': response.headers, 'data': body}
    }

    const _getAllPaginatedResources = (responseHeaders) => {
        const links = {}
        responseHeaders.link.split(',').forEach((link) => {
            let rel = link.match(/; rel="(.*)"/)[1]
            links[rel] = link.match(/<(.*)>/)[1]
        })
        const pageCount = links.last.match(/\d+$/g)[0]
        const pages = []
        for (let i = 0; i < pageCount; i++) {
            let pageUri = links.first.replace(/\d+$/g, `${i + 1}`)
            pages.push(pageUri)
        }
        return pages
    }

    const _getStarConfiguredResource = (gistId) => {
        return _getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}/star`)
    }

    const _noContentRequest = (resourceConfig) => {
        _checkToken()
        return request(resourceConfig)
            .then(() => {
                return true
            }).catch(err => {
                if (404 === err.statusCode)
                    return false
                throw err
            })
    }

    const _getList = (resourceConfig, filterBy) => {
        return co(function* () {
            const page1Response = yield request(resourceConfig).then(res => {return res})
            let paginatedResources = _getAllPaginatedResources(page1Response.headers)
            if (paginatedResources.length > 1) {
                paginatedResources.shift() //First element is removed to avoid repeat first page request
                const promises = []
                paginatedResources.forEach((uri) => {
                    promises.push(request(_getBaseConfiguredResource(uri)))
                })
                return Promise.all(promises).then(function (results) {
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
            return _filter(page1Response.data, filterBy)
        })
    }

    const _filter = (data, filterBy) => {
        const unsetUnreservedFilters = () => {
            const unreservedFilters = []
            const reservedFilters = ['since', 'userName', 'starred', 'public']
            const availableFilters = ['size', 'raw_url', 'type', 'language', 'truncated', 'content']
            filterBy.forEach(filter => {
                let filterName = Object.keys(filter)[0]
                if (reservedFilters.indexOf(filterName) < 0) {
                    if (availableFilters.indexOf(filterName) < 0)
                        console.warn(`You can't use ${filterName}. Only can filter by ${availableFilters}`)
                    else
                        unreservedFilters.push(filter)
                }
            })
            filterBy = unreservedFilters
        }

        const matchWithAllFilters = row => {
            let validatedFilters = 0
            if (row['files']) {
                const fileNames = Object.keys(row['files'])
                fileNames.forEach(fileName => {
                    filterBy.forEach(filter => {
                        let field = Object.keys(filter)[0]
                        let filterValue = filter[field]
                        let fieldValue = row['files'][fileName][field]
                        if (fieldValue && fieldValue.match(filterValue)) {
                            validatedFilters++
                        }
                    })
                })
            }
            return validatedFilters === filterBy.length
        }

        unsetUnreservedFilters()
        return filterBy.length > 0 ? data.filter(matchWithAllFilters) : data
    }
}

module.exports = GistClient
module.exports.GistClient = GistClient
module.exports.default = GistClient
