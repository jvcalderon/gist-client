"use strict"

const request = require('request-promise-native')
const co = require('co')
const _ = require('lodash')

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
            .then(res => { return res.data })
    }

    this.getOneById = (gistId) => {
        _checkToken()
        return request(_getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}`))
            .then(res => { return res.data })
    }

    this.getAll = (configData = {}) => {
        const config = _getListConfig(configData)
        return _getList(_getListConfiguredResource(config['filterBy']), config)
    }

    this.getCommits = (gistId, configData = {}) => {
        _checkToken()
        const config = _getListConfig(configData)
        const url = `/gists/${gistId}/commits`
        return _getList((_getListConfiguredResource(config['filterBy'], url)), config)
    }

    this.getForks = (gistId, configData = {}) => {
        _checkToken()
        const config = _getListConfig(configData)
        const url = `/gists/${gistId}/forks`
        return _getList((_getListConfiguredResource(config['filterBy'], url)), config)
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
        return request(config).then(res => { return res.data })
    }

    this.update = (gistId, data) => {
        _checkToken()
        const config = _getBaseConfiguredResource(API_DOMAIN + `/gists/${gistId}`)
        config.method = 'PATCH'
        config.json = data
        return request(config).then(res => { return res.data })
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
        const authHeader = this.token ? {'Authorization': 'token ' + this.token} : {}
        return {
            url      : resource,
            headers  : Object.assign({}, authHeader, {'User-Agent': 'GistClient'}),
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
            else if (true === starredFilter)
                url = '/gists/starred'
            else if (true === publicFilter)
                url = '/gists/public'
        }

        let resource = API_DOMAIN + url + `?per_page=${PAGE_LIMIT}`
        if (sinceFilter)
            resource += '&since=' + sinceFilter

        return _getBaseConfiguredResource(resource)
    }

    const _includeHeadersTransformer = (body, response) => {
        return {'headers': response.headers, 'data': body}
    }

    const _getAllPaginatedResources = (headers) => {
        const getLastPage = links => links ? _.chain(links).split(',').map(link => link.match(/<(.*)>/)[1]).sort().last().value() : ''
        const getPageNumberFromUri = uri => uri.match(/\d+$/g) ? uri.match(/\d+$/g).pop() : 0
        const generateResources = pageCount => lastPageUri => _.range(pageCount).map(pageNumber => lastPageUri.replace(/\d+$/g, _.add(pageNumber, 1)))

        const lastPage = getLastPage(_.get(headers, 'link'))
        const resourceGenerator = _.flow([getPageNumberFromUri, generateResources])(lastPage)
        return resourceGenerator(lastPage)
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

    const _getList = (resourceConfig, listConfig) => {
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
                    return co(function* () {
                        const results = listConfig['rawContent'] ? yield _fillRawContent(allResults) : allResults
                        return _filter(results, listConfig['filterBy'])
                    })
                })
            }
            const results = listConfig['rawContent'] ? yield _fillRawContent(page1Response.data) : page1Response.data
            return _filter(results, listConfig['filterBy'])
        })
    }

    const _filter = (data, filterBy) => {
        const isValidFilter = filter => {
            const filterMatch = filterList => filterName => filterList.indexOf(filterName) >= 0
            const isAReservedFilter = filterMatch(['since', 'userName', 'starred', 'public'])
            const isAvailableFilter = filterMatch(['size', 'raw_url', 'filename', 'type', 'language', 'truncated', 'content'])

            const filterName = _.chain(filter).keys().first().value()
            return !isAReservedFilter(filterName) && isAvailableFilter(filterName)
        }

        const matchWithAllFilters = filters => gist => {
            const getFilesContent = files => gist => files.map(file => gist.files[file])
            const matchWithFilters = filters => content => {
                const matches = filters.filter(filter => {
                    const filterName = _.chain(filter).keys().first().value()
                    const value = _.get(content, filterName, '')
                    const valueAsString = _.includes(['object', 'array'], typeof value) ? JSON.stringify(value) : value
                    return !!valueAsString.match(filter[filterName])
                })
                return matches.length === filters.length
            }
            const match = matchWithFilters(filters)

            const fileList = _.chain(gist).get('files').keys().value()
            const filteredData = getFilesContent(fileList)(gist).filter(match)
            return filteredData && filteredData.length > 0
        }

        const validFilters = filterBy.filter(isValidFilter)
        const filterMatcher = matchWithAllFilters(validFilters)
        return validFilters.length > 0 ? data.filter(filterMatcher) : data
    }

    const _fillRawContent = (dataList) => {
        return co(function* () {
            for (let i = 0; i < dataList.length; i++) {
                const fileNames = dataList[i]['files'] ? Object.keys(dataList[i]['files']) : []
                for (let j = 0; j < fileNames.length; j++) {
                    let fileName = fileNames[j]
                    let rawUrl = dataList[i]['files'][fileName]['raw_url']
                    if (rawUrl) {
                        let resourceCfg = _getBaseConfiguredResource(rawUrl)
                        dataList[i]['files'][fileName]['content'] = yield request(resourceCfg)
                            .then(res => { return res.data })
                    }
                }
            }
            return dataList
        })
    }

    const _getListConfig = (configData) => {
        return {
            "filterBy": configData['filterBy'] ? configData['filterBy'] : [],
            "rawContent": configData['rawContent'] ? configData['rawContent'] : false
        }
    }
}

module.exports = GistClient
module.exports.GistClient = GistClient
module.exports.default = GistClient
