"use strict"

const nock = require('nock')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect
const GistClient = require("../lib/gistClient")

describe('GistClient', () => {

    describe('#setToken()', () => {
        it('Should set token with given value and return instance of GistClient', () => {
            const TOKEN_VALUE = 'MySecretToken'
            const gistClient = new GistClient()
            const returnedObject = gistClient.setToken(TOKEN_VALUE)
            expect(returnedObject).to.be.an.instanceof(GistClient)
            expect(gistClient.token).to.equal(TOKEN_VALUE)
        })
    })

    describe('#unsetToken()', () => {
        it('Should unset token and return instance of GistClient', () => {
            const gistClient = new GistClient()
            gistClient.setToken('MyToken')
            gistClient.unsetToken()
            expect(gistClient.token).to.be.a('null')
        })
    })

    describe('#getOneById(gistId)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.getOneById('123456')
            } catch (err) {
                expect(err).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should make a request to Gist API and get a single result', () => {
            const URL = 'https://api.github.com/gists/82773a5192a665b659b9afe3e2375e96'
            const ID = '82773a5192a665b659b9afe3e2375e96'
            const DESCRIPTION = 'prueba'
            nock('https://api.github.com')
                .get('/gists/' + ID)
                .reply(200, {
                    url: URL,
                    id: ID,
                    description: DESCRIPTION
                });
            const gistClient = new GistClient()
            gistClient.setToken('MyToken').getOneById(ID).then((result) => {
                expect(result.data.url).to.equal(URL)
                expect(result.data.id).to.equal(ID)
                expect(result.data.description).to.equal(DESCRIPTION)
            })
        })
    })

    describe('#getAll(filterBy, sinceDate)', () => {
        it('Should throw an error if filterBy contains a combination of: userName, starred, public', () => {
            const gistClient = new GistClient()
            return gistClient.getAll([{starred: true}, {public: true}, {since: '2017-07-01T00:00:00Z'}])
                .catch((err) => {
                    return expect(err).to.equal("You cannot combine this filters: userName, starred, public")
                })
        })

        it('Should return all user\'s gists without token in a pagination behaviour', () => {
            const USERNAME = 'jvcalderon'
            const HOST = 'https://api.github.com'
            const RESOURCE = `/users/${USERNAME}/gists`
            const PAGES = 3
            let query = {'per_page': 100}

            const getLinkHeader = (page) => {
                page = page < 1 ? 1 : page
                return { 'Link': `\<${HOST}${RESOURCE}?per_page=${query.per_page}&page=${page + 1}\>; rel="next", <${HOST}${RESOURCE}?per_page=${query.per_page}&page=${PAGES}\>; rel="last", <${HOST}${RESOURCE}?per_page=${query.per_page}&page=1\>; rel="first"` }
            }

            const result1 = [{id: 0}, {id: 1}, {id: 2}, {id: 3}, {id: 4}]
            nock(HOST).get(RESOURCE).query(query).reply(200, result1, getLinkHeader(1))

            query.page = 2
            const result2 = [{id: 5}, {id: 6}, {id: 7}, {id: 8}, {id: 9}]
            nock(HOST).get(RESOURCE).query(query).reply(200, result2, getLinkHeader(2))

            query.page = 3
            const result3 = [{id: 10}, {id: 11}, {id: 12}, {id: 13}, {id: 14}, {id: 15}]
            nock(HOST).get(RESOURCE).query(query).reply(200, result3, getLinkHeader(3))

            const merged_results = result1.concat(result2).concat(result3)

            const gistClient = new GistClient()
            return expect(gistClient.getAll([{userName: USERNAME}])).to.eventually.deep.equal(merged_results)
        })

        it('Should return starred gists', () => {
            nock('https://api.github.com')
                .get('/gists/starred')
                .query({'per_page': 100})
                .reply(200, [{id: 111}], {
                    'Link': '<https://api.github.com/gists/starred?per_page=100&page=1>; rel="first", <https://api.github.com/gists/starred?per_page=100&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(gistClient.setToken('token').getAll([{starred: true}])).to.eventually.deep.equal([{id: 111}])
        })

        it('Should return public gists', () => {
            nock('https://api.github.com')
                .get('/gists/public')
                .query({'per_page': 100})
                .reply(200, [{id: 222}], {
                    'Link': '<https://api.github.com/gists/public?per_page=100&page=1>; rel="first", <https://api.github.com/gists/public?per_page=100&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(gistClient.setToken('token').getAll([{public: true}])).to.eventually.deep.equal([{id: 222}])
        })

        it('Should return gists filtered by since date', () => {
            nock('https://api.github.com')
                .get('/gists')
                .query({'per_page': 100, 'since': '2017-07-01T00:00:00Z'})
                .reply(200, [{id: 333}], {
                    'Link': '<https://api.github.com/gists/public?per_page=100&since=2017-07-01T00:00:00Z&page=1>; rel="first", <https://api.github.com/gists/public?per_page=100&since=2017-07-01T00:00:00Z&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(
                gistClient.setToken('token')
                    .getAll([{since: '2017-07-01T00:00:00Z'}])).to.eventually.deep.equal([{id: 333}]
            )
        })
    })

})
