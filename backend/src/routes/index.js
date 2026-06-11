'use strict';

const router = require('express').Router();

router.use('/feed',        require('./feed'));
router.use('/search',      require('./search'));
router.use('/auth',        require('./auth'));
router.use('/users',       require('./users'));
router.use('/content',     require('./content'));
router.use('/b2b',         require('./b2b'));
router.use('/admin',       require('./admin'));

module.exports = router;
