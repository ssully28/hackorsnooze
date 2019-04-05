const BASE_URL = "https://hack-or-snooze-v2.herokuapp.com";

/**
 * This class maintains the list of individual Story instances
 *  It also has some methods for fetching, adding, and removing stories
 */
class StoryList {
  constructor(stories) {
    this.stories = stories;
  }
  /**
   * This method is designed to be called to generate a new StoryList.
   *  It calls the API, builds an array of Story instances, makes a single StoryList
   * instance out of that, and then returns the StoryList instance.
   * 
   * Note the presence of the `static` keyword: this indicates that getStories
   * is **not** an instance method. Rather, it is a method that is called on the
   * class directly. Why doesn't it make sense for getStories to be an instance method?
   */
  static async getStories() {
    // query the /stories endpoint (no auth required)
    const response = await $.getJSON(`${BASE_URL}/stories`);
    // turn the plain old story objects from the API into instances of the Story class
    const stories = response.stories.map(story => new Story(story));
    // build an instance of our own class using the new array of stories
    const storyList = new StoryList(stories)
    return storyList;
  }
  /**
     * Method to make a POST request to /stories and add the new story to the list
     The function should accept the current instance of User who will post the story
     It should also accept an object which with a title, author, and url
     */
  
  async addStory(user, newStory) {

    // Note - payload works like this...didn't work with double quotes around everything!
    //        Also use pojo rather than a "Story" object!
    let payload = 
    {
      token: user.loginToken,
      story: newStory
    };

    // Do post request to api to write new story:
    const response = await $.post(`${BASE_URL}/stories`, payload);

    // Create a Story object from the returned story
    let returnStory = new Story(response.story);

    return returnStory;
  }
}


/**
 * The User class to primarily represent the current user.
 *  There are helper methods to signup (create), login, and getLoggedInUser
 */
class User {
  constructor(userObj) {
    this.username = userObj.username;
    this.name = userObj.name;
    this.createdAt = userObj.createdAt;
    this.updatedAt = userObj.updatedAt;

    // these are all set to defaults, not passed in by the constructor
    this.loginToken = "";
    this.favorites = [];
    this.ownStories = [];
  }



  // TODO:  Refactor:  
  //    Manage favorites - will need to do this in ui.js too....need to display the favs from the favs array....NOT just hide the 
  //    recent "25" storries
  //    Return values - not really necessary, but good practice in this case.    
  async addFavoriteToUser(storyId){

    // Need the token:
    let payload = 
    {
      token: this.loginToken
    };

    // Then just pass the story id in with the url and the payload (just token in this case):
    const response = await $.post(`${BASE_URL}/users/${this.username}/favorites/${storyId}`, payload);
    
  }

  async removeFavoriteToUser(storyId){

    // Need the token:
    let payload = 
    {
      token: this.loginToken
    };

    // "DELETE" requires us to use 'ajax' (and we need to add the payload here in data)
    let ajaxSettings = {
      type: 'DELETE',
      data: payload
    }

    // Then just pass the story id in with the url and the ajax settings:
    const response = await $.ajax(`${BASE_URL}/users/${this.username}/favorites/${storyId}`, ajaxSettings);
    
  }




  // Returns True if the story is favorited by the user else false:
  hasFavorited(storyId){
    return this.favorites.some(obj => obj.storyId === storyId);
  }

  /*
   A class method to create a new user - it accepts a username, password and name
   It makes a POST request to the API and returns the newly created User as well as a token
   */
  static async create(username, password, name) {
    const response = await $.post(`${BASE_URL}/signup`, {
      user: {
        username,
        password,
        name
      }
    });
    // build a new User instance from the API response
    const newUser = new User(response.user);

    // attach the token to the newUser instance for convenience
    newUser.loginToken = response.token;

    return newUser;
  }

  /*
   A class method to log in a user. It returns the user 
   */
  static async login(username, password) {
    const response = await $.post(`${BASE_URL}/login`, {
      user: {
        username,
        password
      }
    });
    // build a new User instance from the API response
    const existingUser = new User(response.user);

    // instantiate Story instances for the user's favorites and ownStories
    existingUser.favorites = response.user.favorites.map(story => new Story(story));
    existingUser.ownStories = response.user.stories.map(story => new Story(story));

    // attach the token to the newUser instance for convenience
    existingUser.loginToken = response.token;

    return existingUser;
  }

  /**
   * This function uses the token & username to make an API request to get details
   *   about the user. Then it creates an instance of user with that inf function.
   */
  static async getLoggedInUser(token, username) {
    // if we don't have user info, return null
    if (!token || !username) return null;

    // call the API
    const response = await $.getJSON(`${BASE_URL}/users/${username}`, {
      token
    });
    // instantiate the user from the API information
    const existingUser = new User(response.user);

    // attach the token to the newUser instance for convenience
    existingUser.loginToken = token;

    // instantiate Story instances for the user's favorites and ownStories
    existingUser.favorites = response.user.favorites.map(
      story => new Story(story)
    );
    existingUser.ownStories = response.user.stories.map(
      story => new Story(story)
    );
    return existingUser;
  }
}



/**
 * Class to represent a single story. Has one method to update.
 */
class Story {
  /*
   * The constructor is designed to take an object for better readability / flexibility
   */
  constructor(storyObj) {
    this.author = storyObj.author;
    this.title = storyObj.title;
    this.url = storyObj.url;
    this.username = storyObj.username;
    this.storyId = storyObj.storyId;
    this.createdAt = storyObj.createdAt;
    this.updatedAt = storyObj.updatedAt;
  }
}