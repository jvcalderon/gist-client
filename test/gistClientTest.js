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
            return expect(gistClient.token).to.be.a('null')
        })
    })

    describe('#getOneById(gistId)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.getOneById('123456')
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
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
                expect(result.url).to.equal(URL)
                expect(result.id).to.equal(ID)
                expect(result.description).to.equal(DESCRIPTION)
            })
        })
    })

    describe('#getRevision(gistId)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.getRevision('aa5a315d61ae9438b18d')
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should make a request to Gist API and get a single result', () => {
            const SHA = 'aa5a315d61ae9438b18d'
            const ID = '82773a5192a665b659b9afe3e2375e96'
            const URL = 'https://api.github.com/gists/' + ID + '/' + SHA
            nock('https://api.github.com')
                .get('/gists/' + ID + '/' + SHA)
                .reply(200, {
                    url: URL,
                    id: ID
                });
            const gistClient = new GistClient()
            gistClient.setToken('MyToken').getRevision(ID, SHA).then((result) => {
                expect(result.url).to.equal(URL)
                expect(result.id).to.equal(ID)
            })
        })
    })

    describe('#getAll(filterBy, sinceDate)', () => {
        it('Should throw an error if filterBy contains a combination of: userName, starred, public', () => {
            const gistClient = new GistClient()
            try {
                gistClient.getAll({filterBy: [{starred: true}, {public: true}, {since: '2017-07-01T00:00:00Z'}]})
            }
            catch(err) {
                return expect(err.message).to.equal("You cannot combine this filters: userName, starred, public")
            }
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
            return expect(gistClient.getAll({filterBy: [{userName: USERNAME}]}))
                .to.eventually.deep.equal(merged_results)
        })

        it('Should return starred gists', () => {
            nock('https://api.github.com')
                .get('/gists/starred')
                .query({'per_page': 100})
                .reply(200, [{id: 111}], {
                    'Link': '<https://api.github.com/gists/starred?per_page=100&page=1>; rel="first", <https://api.github.com/gists/starred?per_page=100&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(gistClient.setToken('token').getAll({filterBy: [{starred: true}]}))
                .to.eventually.deep.equal([{id: 111}])
        })

        it('Should return public gists', () => {
            nock('https://api.github.com')
                .get('/gists/public')
                .query({'per_page': 100})
                .reply(200, [{id: 222}], {
                    'Link': '<https://api.github.com/gists/public?per_page=100&page=1>; rel="first", <https://api.github.com/gists/public?per_page=100&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(gistClient.setToken('token').getAll({filterBy: [{public: true}]}))
                .to.eventually.deep.equal([{id: 222}])
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
                    .getAll({filterBy: [{since: '2017-07-01T00:00:00Z'}]})).to.eventually.deep.equal([{id: 333}]
            )
        })

        it('Should return gists filtered by filename', () => {
            nock('https://api.github.com')
                .get('/gists')
                .query({'per_page': 100})
                .reply(200, [
                    {"id": 1, "files": {"x.json" : {}}},
                    {"id": 2, "files": {"y.json" : {"filename": "y.json"}}}
                ], {
                    'Link': '<https://api.github.com/gists/public?per_page=100&page=1>; rel="first", <https://api.github.com/gists/public?per_page=100&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(gistClient.setToken('token').getAll({filterBy: [{filename: "y.json"}]}))
                .to.eventually.deep.equal([{"id": 2, "files": {"y.json" : {"filename": "y.json"}}}])
        })

        it('Should return gist filtered by some fields', () => {
            const getMockRow = (gistId, description, language, content = null) => {
                const mock = {
                    "url": "https://api.github.com/gists/" + gistId,
                    "id": gistId,
                    "description": description,
                    "public": true,
                    "owner": {
                        "id": 1,
                    },
                    "user": null,
                    "files": {
                        "ring.erl": {
                            "size": 932,
                            "raw_url": "https://gist.githubusercontent.com/raw/" + gistId,
                            "type": "text/plain",
                            "truncated": false,
                            "language": language
                        }
                    }
                }
                if (content) {
                    mock.files['ring.erl']['content'] = content
                }
                return mock
            }
            const gistList = [
                getMockRow(1, 'Description for Javascript', 'Javascript'),
                getMockRow(2, 'Description for Java', 'Java'),
                getMockRow(3, 'Description for Java', 'Erlang'),
                getMockRow(4, 'Description for PHP', 'PHP')
            ]

            nock('https://api.github.com')
                .get('/gists/public')
                .query({'per_page': 100})
                .reply(200, gistList, {
                    'Link': '<https://api.github.com/gists/public?per_page=100&page=1>; rel="first", <https://api.github.com/gists/public?per_page=100&page=1>; rel="last"'
                })
            nock('https://gist.githubusercontent.com').get('/raw/1').reply(200, "Javascript")
            nock('https://gist.githubusercontent.com').get('/raw/2').reply(200, "Java")
            nock('https://gist.githubusercontent.com').get('/raw/3').reply(200, "Erlang")
            nock('https://gist.githubusercontent.com').get('/raw/4').reply(200, "PHP")

            const filterBy = [{"content": "Java"}, {"language": "Java"}, {"public": true}]
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').getAll({"filterBy": filterBy, "rawContent": true}))
                .to.eventually.deep.equal([
                    getMockRow(1, 'Description for Javascript', 'Javascript', 'Javascript'),
                    getMockRow(2, 'Description for Java', 'Java', 'Java')
                ])
        })

        it('Doesn`t need token to get content', () => {
            nock('https://api.github.com')
                .get('/gists')
                .query({'per_page': 100, 'since': '2017-07-01T00:00:00Z'})
                .reply(200, [{id: 333}], {
                    'Link': '<https://api.github.com/gists/public?per_page=100&since=2017-07-01T00:00:00Z&page=1>; rel="first", <https://api.github.com/gists/public?per_page=100&since=2017-07-01T00:00:00Z&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(
                gistClient.getAll({filterBy: [{since: '2017-07-01T00:00:00Z'}]})).to.eventually.deep.equal([{id: 333}]
            )
        })
    })

    describe('#isStarred(gistId)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.isStarred('11111')
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should make a request to Gist API and return true if gist is starred', () => {
            nock('https://api.github.com')
                .get('/gists/1/star')
                .reply(204, null);
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').isStarred('1')).to.eventually.deep.equal(true)
        })

        it('Should make a request to Gist API and return false if gist is not starred', () => {
            nock('https://api.github.com')
                .get('/gists/2/star')
                .reply(404, null);
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').isStarred('2')).to.eventually.deep.equal(false)
        })

        it('Should throw an error if response status code is not 204 or 404', () => {
            nock('https://api.github.com')
                .get('/gists/2/star')
                .reply(500, null);
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').isStarred('2')).to.eventually.be.rejectedWith(Error)
        })
    })

    describe('#star(gistId)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.star('11111')
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should make a request to Gist API to mark gist as starred', () => {
            nock('https://api.github.com')
                .put('/gists/1/star')
                .reply(204, null);
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').star('1')).to.eventually.deep.equal(true)
        })
    })

    describe('#unstar(gistId)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.unstar('11111')
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should make a request to Gist API to mark gist as unstarred', () => {
            nock('https://api.github.com')
                .delete('/gists/1/star')
                .reply(204, null);
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').unstar('1')).to.eventually.deep.equal(true)
        })
    })

    describe('#getCommits(gistId, filterBy)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.getCommits('aa5a315d61ae9438b18d')
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should return all gist\'s commits', () => {
            const result = [{"version": '1'}, {"version": '2'}, {"version": '3'}]
            nock('https://api.github.com')
                .get('/gists/1/commits')
                .query({'per_page': 100})
                .reply(200, result, {
                    'Link': '<https://api.github.com/gists/1/commits?per_page=100&page=1>; rel="first", <https://api.github.com/gists/1/commits?per_page=100&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').getCommits('1')).to.eventually.deep.equal(result)
        })
    })

    describe('#getForks(gistId, filterBy)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.getForks('aa5a315d61ae9438b18d')
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should return all gist\'s forks', () => {
            const result = [{"id": '1'}, {"id": '2'}, {"id": '3'}]
            nock('https://api.github.com')
                .get('/gists/1/forks')
                .query({'per_page': 100})
                .reply(200, result, {
                    'Link': '<https://api.github.com/gists/1/forks?per_page=100&page=1>; rel="first", <https://api.github.com/gists/1/forks?per_page=100&page=1>; rel="last"'
                })
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').getForks('1')).to.eventually.deep.equal(result)
        })
    })

    describe('#create(data)', () => {
        const gist = {
            "files": [{
                "x.txt": {
                    "content": "xx"
                }
            }],
            "description": "desc",
            "public": true
        }

        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.create(gist)
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should make a post to create a gist and returns its content', () => {
            nock('https://api.github.com')
                .post('/gists', gist)
                .reply(201, gist)
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken')
                .create(gist)).to.eventually.deep.equal(gist)
        })
    })

    describe('#update(data)', () => {
        const gist = {
            "files": [{
                "x.txt": {
                    "content": "xx"
                }
            }],
            "description": "desc",
            "public": true
        }

        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.update(1, gist)
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should make a patch to update a gist and returns its content', () => {
            nock('https://api.github.com')
                .patch('/gists/1', gist)
                .reply(200, gist)
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken')
                .update(1, gist)).to.eventually.deep.equal(gist)
        })
    })

    describe('#delete(data)', () => {
        it('Should throw an error if token is not set', () => {
            const gistClient = new GistClient()
            try {
                gistClient.delete(1)
            } catch (err) {
                return expect(err.message).to.equal("You need to set token before by setToken() method")
            }
        })

        it('Should make a request to Gist API to delete a gist', () => {
            nock('https://api.github.com')
                .delete('/gists/1')
                .reply(204, null);
            const gistClient = new GistClient()
            return expect(gistClient.setToken('MyToken').delete('1')).to.eventually.deep.equal(true)
        })
    })

})
