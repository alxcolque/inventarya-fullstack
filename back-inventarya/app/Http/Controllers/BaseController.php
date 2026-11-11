<?php

namespace App\Http\Controllers;

use App\Traits\ApiResponseTrait;
use Illuminate\Routing\Controller as LaravelController;

abstract class BaseController extends LaravelController
{
    use ApiResponseTrait;

    /**
     * Common constructor for all controllers.
     */
    public function __construct()
    {
        // Add common logic here if needed
    }
}
